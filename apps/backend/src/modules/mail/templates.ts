import type { MailMessage } from './mail.types';

/**
 * Transactional email templates. Inline styles only — email clients strip
 * <style> blocks — and every template carries a plain-text twin.
 */

const GOLD = '#d4af37';
const BG = '#0c0a09';
const CARD = '#1c1917';
const TEXT = '#e7e5e4';
const MUTED = '#a8a29e';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function layout(title: string, bodyHtml: string): string {
  return `<div style="background:${BG};padding:32px 16px;font-family:Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:${CARD};border:1px solid #292524;border-radius:12px;padding:32px">
    <p style="margin:0 0 24px;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:${GOLD}">Grillz Studio</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:${TEXT}">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="margin:32px 0 0;font-size:12px;color:${MUTED}">If you did not request this, you can safely ignore this email.</p>
  </div>
</div>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:${GOLD};color:#1c1917;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px">${escapeHtml(label)}</a></p>
<p style="margin:0;font-size:12px;color:${MUTED};word-break:break-all">Or paste this link into your browser: ${escapeHtml(url)}</p>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${TEXT}">${escapeHtml(text)}</p>`;
}

export function verifyEmailTemplate(input: { to: string; name: string | null; url: string }): MailMessage {
  const greeting = input.name ? `Hi ${input.name},` : 'Hi,';
  return {
    to: input.to,
    subject: 'Verify your email — Grillz Studio',
    html: layout(
      'Verify your email',
      paragraph(greeting) +
        paragraph('Confirm this address to secure your Grillz Studio account. The link is valid for 24 hours.') +
        button(input.url, 'Verify email'),
    ),
    text: `${greeting}\n\nConfirm your Grillz Studio email address (valid 24 hours):\n${input.url}\n\nIf you did not create an account, ignore this email.`,
  };
}

export function resetPasswordTemplate(input: { to: string; name: string | null; url: string }): MailMessage {
  const greeting = input.name ? `Hi ${input.name},` : 'Hi,';
  return {
    to: input.to,
    subject: 'Reset your password — Grillz Studio',
    html: layout(
      'Reset your password',
      paragraph(greeting) +
        paragraph('Someone requested a password reset for this account. The link is valid for 1 hour and can be used once.') +
        button(input.url, 'Choose a new password'),
    ),
    text: `${greeting}\n\nReset your Grillz Studio password (valid 1 hour, single use):\n${input.url}\n\nIf you did not request this, ignore this email — your password is unchanged.`,
  };
}

export function orderPaidTemplate(input: {
  to: string;
  name: string | null;
  orderNumber: string;
  totalMinor: number;
  currency: string;
  orderUrl: string;
}): MailMessage {
  const greeting = input.name ? `Hi ${input.name},` : 'Hi,';
  const total = `${(input.totalMinor / 100).toFixed(2)} ${input.currency}`;
  return {
    to: input.to,
    subject: `Order ${input.orderNumber} confirmed — Grillz Studio`,
    html: layout(
      'Your order is confirmed',
      paragraph(greeting) +
        paragraph(`Payment of ${total} for order ${input.orderNumber} went through and your design is heading to production.`) +
        paragraph('We will email you at every production stage. You can follow progress in your dashboard at any time.') +
        button(input.orderUrl, 'Track your order'),
    ),
    text: `${greeting}\n\nPayment of ${total} for order ${input.orderNumber} is confirmed — your design is heading to production.\n\nTrack it here:\n${input.orderUrl}`,
  };
}
