import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

/**
 * scrypt password hashing (Node built-in; memory-hard, no native deps).
 * Format: scrypt:<salt-hex>:<hash-hex> — self-describing for future migration.
 */
@Injectable()
export class PasswordService {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derived = await scryptAsync(plain, salt, 64);
    return `scrypt:${salt}:${derived.toString('hex')}`;
  }

  async verify(plain: string, stored: string): Promise<boolean> {
    const [scheme, salt, hashHex] = stored.split(':');
    if (scheme !== 'scrypt' || !salt || !hashHex) return false;
    const derived = await scryptAsync(plain, salt, 64);
    const expected = Buffer.from(hashHex, 'hex');
    if (expected.length !== derived.length) return false;
    return timingSafeEqual(derived, expected);
  }
}
