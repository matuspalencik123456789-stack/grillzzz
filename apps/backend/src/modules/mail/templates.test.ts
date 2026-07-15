import { describe, expect, it } from 'vitest';
import { orderPaidTemplate, resetPasswordTemplate, verifyEmailTemplate } from './templates';

describe('mail templates', () => {
  it('reset template carries the link in html and text', () => {
    const msg = resetPasswordTemplate({
      to: 'a@b.c',
      name: 'Ada',
      url: 'https://app.example.com/reset-password?token=t0k3n',
    });
    expect(msg.to).toBe('a@b.c');
    expect(msg.subject).toContain('Reset');
    expect(msg.html).toContain('https://app.example.com/reset-password?token=t0k3n');
    expect(msg.text).toContain('https://app.example.com/reset-password?token=t0k3n');
    expect(msg.html).toContain('Hi Ada,');
  });

  it('verify template handles a missing name', () => {
    const msg = verifyEmailTemplate({ to: 'a@b.c', name: null, url: 'https://x/verify-email?token=t' });
    expect(msg.html).toContain('Hi,');
    expect(msg.text).toContain('https://x/verify-email?token=t');
  });

  it('order template formats minor units', () => {
    const msg = orderPaidTemplate({
      to: 'a@b.c',
      name: 'Ada',
      orderNumber: 'GS-2026-000042',
      totalMinor: 587563,
      currency: 'USD',
      orderUrl: 'https://x/orders/o1',
    });
    expect(msg.subject).toContain('GS-2026-000042');
    expect(msg.html).toContain('5875.63 USD');
    expect(msg.text).toContain('5875.63 USD');
  });

  it('escapes html in interpolated values', () => {
    const msg = verifyEmailTemplate({
      to: 'a@b.c',
      name: '<script>alert(1)</script>',
      url: 'https://x/verify?token=t',
    });
    expect(msg.html).not.toContain('<script>');
    expect(msg.html).toContain('&lt;script&gt;');
  });
});
