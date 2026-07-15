import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { ActionTokenService } from './action-token.service';
import { MailModule } from '../mail/mail.module';
import { CONFIG, type AppConfig } from '../../config/config';

@Global() // JwtModule is needed by the app-wide JwtAuthGuard
@Module({
  imports: [
    MailModule,
    JwtModule.registerAsync({
      global: true,
      inject: [CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.JWT_SECRET,
        signOptions: { issuer: 'grillz-studio' },
        verifyOptions: { issuer: 'grillz-studio' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, ActionTokenService],
  exports: [AuthService, PasswordService, ActionTokenService],
})
export class AuthModule {}
