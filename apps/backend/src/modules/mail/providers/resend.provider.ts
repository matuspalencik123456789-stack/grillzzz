import type { MailMessage, MailProvider } from '../mail.types';

/** Transactional email via the Resend REST API (https://resend.com/docs). */
export class ResendMailProvider implements MailProvider {
  readonly name = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: MailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend responded ${res.status}: ${body.slice(0, 300)}`);
    }
  }
}
