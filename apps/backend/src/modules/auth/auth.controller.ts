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
  loginSchema,
  refreshSchema,
  registerSchema,
  type FederatedLoginDto,
  type LoginDto,
  type RefreshDto,
  type RegisterDto,
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
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
