import { Module } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../../config/config';
import { MAIL_PROVIDER, type MailProvider } from './mail.types';
import { ResendMailProvider } from './providers/resend.provider';
import { ConsoleMailProvider } from './providers/console.provider';
import { MailService } from './mail.service';

@Module({
  providers: [
    {
      provide: MAIL_PROVIDER,
      inject: [CONFIG],
      useFactory: (config: AppConfig): MailProvider =>
        config.RESEND_API_KEY
          ? new ResendMailProvider(config.RESEND_API_KEY, config.MAIL_FROM)
          : new ConsoleMailProvider(),
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
