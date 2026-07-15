import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Ip,
  Post,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import {
  federatedLoginSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type FederatedLoginDto,
  type ForgotPasswordDto,
  type LoginDto,
  type RefreshDto,
  type RegisterDto,
  type ResetPasswordDto,
  type VerifyEmailDto,
} from '@grillz/shared-types';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Public, RateLimit, type AuthenticatedUser } from '../../common/decorators';
import { CONFIG, type AppConfig } from '../../config/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @RateLimit({ limit: 10, windowSec: 60 })
  @Post('register')
  register(@Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto, @Ip() ip: string) {
    return this.auth.register(dto, ip);
  }

  @Public()
  @RateLimit({ limit: 10, windowSec: 60 })
  @HttpCode(200)
  @Post('login')
  login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  /**
   * Server-to-server only: the Next.js host exchanges a verified Google
   * profile for API tokens. Guarded by the shared AUTH_SECRET.
   */
  @Public()
  @RateLimit({ limit: 30, windowSec: 60 })
  @HttpCode(200)
  @Post('federated')
  federated(
    @Body(new ZodValidationPipe(federatedLoginSchema)) dto: FederatedLoginDto,
    @Headers('x-internal-auth') internalAuth: string | undefined,
    @Ip() ip: string,
  ) {
    const secret = this.config.AUTH_SECRET;
    if (!secret || !internalAuth || !safeEqual(internalAuth, secret)) {
      throw new UnauthorizedException('Federated login is server-to-server only');
    }
    return this.auth.federatedLogin(dto, ip);
  }

  @Public()
  @RateLimit({ limit: 30, windowSec: 60 })
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto, @Ip() ip: string) {
    return this.auth.refresh(dto.refreshToken, ip);
  }

  @HttpCode(204)
  @Post('logout')
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.logout(user.id);
  }

  /** Always 200 — the response must not reveal whether the account exists. */
  @Public()
  @RateLimit({ limit: 5, windowSec: 300 })
  @HttpCode(200)
  @Post('forgot-password')
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) dto: ForgotPasswordDto,
    @Ip() ip: string,
  ) {
    await this.auth.requestPasswordReset(dto.email, ip);
    return { ok: true };
  }

  @Public()
  @RateLimit({ limit: 10, windowSec: 300 })
  @HttpCode(200)
  @Post('reset-password')
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordDto,
    @Ip() ip: string,
  ) {
    await this.auth.resetPassword(dto.token, dto.password, ip);
    return { ok: true };
  }

  @Public()
  @RateLimit({ limit: 10, windowSec: 300 })
  @HttpCode(200)
  @Post('verify-email')
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) dto: VerifyEmailDto,
    @Ip() ip: string,
  ) {
    await this.auth.verifyEmail(dto.token, ip);
    return { ok: true };
  }

  @RateLimit({ limit: 3, windowSec: 300 })
  @HttpCode(200)
  @Post('resend-verification')
  async resendVerification(@CurrentUser() user: AuthenticatedUser) {
    await this.auth.resendVerification(user.id);
    return { ok: true };
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
