import { describe, expect, it, vi } from 'vitest';
import { MemoryKv } from './kv';
import { MemoryJobQueue } from './job-queue';

describe('MemoryKv', () => {
  it('get/set/del round-trips', async () => {
    const kv = new MemoryKv();
    expect(await kv.get('a')).toBeNull();
    await kv.set('a', '1', 'EX', 60);
    expect(await kv.get('a')).toBe('1');
    expect(await kv.del('a', 'missing')).toBe(1);
    expect(await kv.get('a')).toBeNull();
  });

  it('honors TTL', async () => {
    vi.useFakeTimers();
    try {
      const kv = new MemoryKv();
      await kv.set('a', '1', 'EX', 10);
      vi.advanceTimersByTime(9_000);
      expect(await kv.get('a')).toBe('1');
      vi.advanceTimersByTime(2_000);
      expect(await kv.get('a')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('incr counts and expire arms a TTL like the rate limiter expects', async () => {
    vi.useFakeTimers();
    try {
      const kv = new MemoryKv();
      expect(await kv.incr('rl')).toBe(1);
      expect(await kv.incr('rl')).toBe(2);
      expect(await kv.expire('rl', 5)).toBe(1);
      vi.advanceTimersByTime(6_000);
      expect(await kv.incr('rl')).toBe(1);
      expect(await kv.expire('missing', 5)).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('pings', async () => {
    expect(await new MemoryKv().ping()).toBe('PONG');
  });
});

describe('MemoryJobQueue', () => {
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it('runs jobs added after a consumer registered', async () => {
    const queue = new MemoryJobQueue<number>('t');
    const seen: number[] = [];
    queue.process(async (job) => {
      seen.push(job.data);
    });
    await queue.add('j', 1);
    await queue.add('j', 2);
    await flush();
    expect(seen).toEqual([1, 2]);
    await queue.close();
  });

  it('buffers jobs enqueued before the consumer registers', async () => {
    const queue = new MemoryJobQueue<string>('t');
    await queue.add('j', 'early');
    const seen: string[] = [];
    queue.process(async (job) => {
      seen.push(job.data);
    });
    await flush();
    expect(seen).toEqual(['early']);
    await queue.close();
  });

  it('drops duplicate jobIds while pending, allows re-add after completion', async () => {
    const queue = new MemoryJobQueue<string>('t');
    let runs = 0;
    await queue.add('j', 'a', { jobId: 'scan-1' });
    await queue.add('j', 'a', { jobId: 'scan-1' });
    queue.process(async () => {
      runs += 1;
    });
    await flush();
    expect(runs).toBe(1);
    await queue.add('j', 'a', { jobId: 'scan-1' });
    await flush();
    expect(runs).toBe(2);
    await queue.close();
  });

  it('retries with backoff up to 3 attempts', async () => {
    const queue = new MemoryJobQueue<string>('t', 10);
    let attempts = 0;
    queue.process(async () => {
      attempts += 1;
      throw new Error('boom');
    });
    await queue.add('j', 'x');
    await flush();
    expect(attempts).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(attempts).toBe(3);
    await queue.close();
  });

  it('recovers when a retry succeeds', async () => {
    const queue = new MemoryJobQueue<string>('t', 5);
    let attempts = 0;
    const done: string[] = [];
    queue.process(async (job) => {
      attempts += 1;
      if (attempts < 2) throw new Error('flaky');
      done.push(job.data);
    });
    await queue.add('j', 'x', { jobId: 'k' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(done).toEqual(['x']);
    await queue.close();
  });
});
