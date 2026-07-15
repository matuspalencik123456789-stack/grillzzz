import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { Inject } from '@nestjs/common';
import type {
  AuthTokens,
  FederatedLoginDto,
  LoginDto,
  RegisterDto,
  Role,
} from '@grillz/shared-types';
import { PrismaService } from '../../infra/prisma.module';
import { PasswordService } from './password.service';
import {
  ActionTokenService,
  RESET_TOKEN_TTL_MS,
  VERIFY_TOKEN_TTL_MS,
} from './action-token.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { resetPasswordTemplate, verifyEmailTemplate } from '../mail/templates';
import { CONFIG, type AppConfig } from '../../config/config';

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly actionTokens: ActionTokenService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async register(dto: RegisterDto, ip?: string): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash: await this.passwords.hash(dto.password),
      },
    });
    this.audit.record({ actorId: user.id, action: 'auth.register', entityType: 'User', entityId: user.id, ip });
    await this.sendVerificationEmail(user.id, user.email, user.name);
    return { user: toPublic(user), tokens: await this.issueTokens(user.id, user.email, user.role) };
  }

  /**
   * Always resolves — a "does this account exist" oracle would enable user
   * enumeration. OAuth-only accounts may set a password this way.
   */
  async requestPasswordReset(email: string, ip?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return;

    const token = await this.actionTokens.issue(user.id, 'PASSWORD_RESET', RESET_TOKEN_TTL_MS);
    this.audit.record({ actorId: user.id, action: 'auth.password_reset_requested', entityType: 'User', entityId: user.id, ip });
    await this.mail.sendSafe(
      resetPasswordTemplate({
        to: user.email,
        name: user.name,
        url: `${this.config.APP_URL}/reset-password?token=${token}`,
      }),
    );
  }

  async resetPassword(token: string, password: string, ip?: string): Promise<void> {
    const userId = await this.actionTokens.consume(token, 'PASSWORD_RESET');
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(password) },
    });
    // a reset proves email control, and every existing session is now suspect
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.audit.record({ actorId: userId, action: 'auth.password_reset', entityType: 'User', entityId: userId, ip });
  }

  async verifyEmail(token: string, ip?: string): Promise<void> {
    const userId = await this.actionTokens.consume(token, 'EMAIL_VERIFICATION');
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    });
    this.audit.record({ actorId: userId, action: 'auth.email_verified', entityType: 'User', entityId: userId, ip });
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.emailVerified) return;
    await this.sendVerificationEmail(user.id, user.email, user.name);
  }

  private async sendVerificationEmail(userId: string, email: string, name: string | null): Promise<void> {
    const token = await this.actionTokens.issue(userId, 'EMAIL_VERIFICATION', VERIFY_TOKEN_TTL_MS);
    await this.mail.sendSafe(
      verifyEmailTemplate({
        to: email,
        name,
        url: `${this.config.APP_URL}/verify-email?token=${token}`,
      }),
    );
  }

  async login(dto: LoginDto, ip?: string): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // uniform error for missing user / wrong password / oauth-only account
    if (!user?.passwordHash || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await this.passwords.verify(dto.password, user.passwordHash);
    if (!valid) {
      this.audit.record({ action: 'auth.login_failed', entityType: 'User', entityId: user.id, ip });
      throw new UnauthorizedException('Invalid credentials');
    }
    this.audit.record({ actorId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id, ip });
    return { user: toPublic(user), tokens: await this.issueTokens(user.id, user.email, user.role) };
  }

  /**
   * Trusted server-to-server login from the Next.js host after a verified
   * Google OAuth flow (Auth.js). Links the federated identity to an existing
   * account by email or provisions a new one.
   */
  async federatedLogin(dto: FederatedLoginDto, ip?: string): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const account = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: dto.provider,
          providerAccountId: dto.providerAccountId,
        },
      },
      include: { user: true },
    });

    let user = account?.user ?? null;
    if (!user) {
      user = await this.prisma.user.upsert({
        where: { email: dto.email },
        update: { emailVerified: new Date(), image: dto.image ?? undefined },
        create: {
          email: dto.email,
          name: dto.name ?? null,
          image: dto.image ?? null,
          emailVerified: new Date(),
        },
      });
      await this.prisma.account.create({
        data: {
          userId: user.id,
          type: 'oauth',
          provider: dto.provider,
          providerAccountId: dto.providerAccountId,
        },
      });
    }
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    this.audit.record({ actorId: user.id, action: 'auth.login_google', entityType: 'User', entityId: user.id, ip });
    return { user: toPublic(user), tokens: await this.issueTokens(user.id, user.email, user.role) };
  }

  async refresh(refreshToken: string, ip?: string): Promise<AuthTokens> {
    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (stored.revokedAt) {
      // reuse of a rotated token ⇒ the token was stolen; revoke the whole family
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.audit.record({
        actorId: stored.userId,
        action: 'auth.refresh_reuse_detected',
        entityType: 'User',
        entityId: stored.userId,
        ip,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.user.id, stored.user.email, stored.user.role);
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.audit.record({ actorId: userId, action: 'auth.logout', entityType: 'User', entityId: userId });
  }

  private async issueTokens(userId: string, email: string, role: Role): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role, type: 'access' },
      { expiresIn: this.config.JWT_EXPIRES_IN },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + parseDuration(this.config.JWT_REFRESH_EXPIRES_IN)),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(parseDuration(this.config.JWT_EXPIRES_IN) / 1000),
    };
  }
}

function toPublic(user: {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
}): PublicUser {
  return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** "15m" | "12h" | "30d" | "45s" → milliseconds */
export function parseDuration(spec: string): number {
  const match = /^(\d+)([smhd])$/.exec(spec.trim());
  if (!match) throw new Error(`Invalid duration "${spec}"`);
  const value = Number(match[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return value * unit;
}
