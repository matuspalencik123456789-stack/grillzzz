/**
 * The exact key-value surface the app uses. ioredis satisfies it structurally;
 * MemoryKv reimplements it in-process for Redis-less local development
 * (REDIS_URL=memory) — e.g. Windows machines without admin rights where
 * neither Docker nor a native Redis can be installed.
 */
export interface KvClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttlSec: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, ttlSec: number): Promise<number>;
  ping(): Promise<string>;
  quit(): Promise<unknown>;
}

interface Entry {
  value: string;
  expiresAt: number | null;
}

export class MemoryKv implements KvClient {
  private readonly store = new Map<string, Entry>();

  private live(key: string): Entry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  async get(key: string): Promise<string | null> {
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string, _mode: 'EX', ttlSec: number): Promise<'OK'> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) if (this.store.delete(key)) removed += 1;
    return removed;
  }

  async incr(key: string): Promise<number> {
    const current = this.live(key);
    const next = current ? Number(current.value) + 1 : 1;
    this.store.set(key, { value: String(next), expiresAt: current?.expiresAt ?? null });
    return next;
  }

  async expire(key: string, ttlSec: number): Promise<number> {
    const entry = this.live(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + ttlSec * 1000;
    return 1;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<'OK'> {
    this.store.clear();
    return 'OK';
  }
}
