export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailProvider {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}

export const MAIL_PROVIDER = 'MAIL_PROVIDER' as const;
