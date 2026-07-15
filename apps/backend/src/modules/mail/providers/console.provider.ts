import { Logger } from '@nestjs/common';
import type { MailMessage, MailProvider } from '../mail.types';

/**
 * Dev/test fallback when no email API key is configured: prints the message
 * to stdout so links (password reset, verification) can be followed locally.
 */
export class ConsoleMailProvider implements MailProvider {
  readonly name = 'console';
  private readonly logger = new Logger('Mail');

  async send(message: MailMessage): Promise<void> {
    this.logger.log(
      `[not sent — no RESEND_API_KEY] to=${message.to} subject="${message.subject}"\n${message.text}`,
    );
  }
}
