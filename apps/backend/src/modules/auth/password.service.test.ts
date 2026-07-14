import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service';
import { parseDuration } from './auth.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes and verifies', async () => {
    const hash = await service.hash('correct horse battery staple');
    expect(hash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(await service.verify('correct horse battery staple', hash)).toBe(true);
    expect(await service.verify('wrong password', hash)).toBe(false);
  });

  it('produces unique salts', async () => {
    const a = await service.hash('same');
    const b = await service.hash('same');
    expect(a).not.toBe(b);
  });

  it('rejects malformed stored hashes without throwing', async () => {
    expect(await service.verify('x', 'not-a-hash')).toBe(false);
    expect(await service.verify('x', 'bcrypt:aa:bb')).toBe(false);
  });
});

describe('parseDuration', () => {
  it('parses units', () => {
    expect(parseDuration('15m')).toBe(900_000);
    expect(parseDuration('12h')).toBe(43_200_000);
    expect(parseDuration('30d')).toBe(2_592_000_000);
    expect(parseDuration('45s')).toBe(45_000);
  });
  it('throws on garbage', () => {
    expect(() => parseDuration('soon')).toThrow();
  });
});
