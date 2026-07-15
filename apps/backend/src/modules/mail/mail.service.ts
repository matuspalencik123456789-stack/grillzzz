import { Inject, Injectable, Logger } from '@nestjs/common';
import { MAIL_PROVIDER, type MailMessage, type MailProvider } from './mail.types';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(@Inject(MAIL_PROVIDER) private readonly provider: MailProvider) {}

  /**
   * Send without throwing: a mail outage must never fail the business action
   * that triggered it (registration, payment settlement, …). Failures are
   * logged and the audit trail of the parent action stays intact.
   */
  async sendSafe(message: MailMessage): Promise<boolean> {
    try {
      await this.provider.send(message);
      return true;
    } catch (error) {
      this.logger.error(
        `email via ${this.provider.name} to ${message.to} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
