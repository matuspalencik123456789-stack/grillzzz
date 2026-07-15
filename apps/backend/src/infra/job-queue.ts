import { Logger } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';

/**
 * The queue surface the app uses, decoupled from BullMQ so local development
 * can run without Redis (REDIS_URL=memory). Producers call add(); exactly one
 * consumer per queue registers with process().
 */
export interface JobContext<T> {
  data: T;
  updateProgress(progress: unknown): Promise<void>;
}

export interface JobQueue<T = unknown> {
  add(name: string, data: T, opts?: { jobId?: string }): Promise<void>;
  process(handler: (job: JobContext<T>) => Promise<void>, concurrency?: number): void;
  close(): Promise<void>;
}

const ATTEMPTS = 3;
const BACKOFF_MS = 5000;

export class BullJobQueue<T = unknown> implements JobQueue<T> {
  private readonly logger: Logger;
  private readonly queue: Queue;
  private worker: Worker<T> | null = null;

  constructor(
    private readonly name: string,
    private readonly redisUrl: string,
  ) {
    this.logger = new Logger(`Queue:${name}`);
    this.queue = new Queue(name, {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: ATTEMPTS,
        backoff: { type: 'exponential', delay: BACKOFF_MS },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    });
  }

  async add(name: string, data: T, opts?: { jobId?: string }): Promise<void> {
    await this.queue.add(name, data, opts);
  }

  process(handler: (job: JobContext<T>) => Promise<void>, concurrency = 1): void {
    this.worker = new Worker<T>(this.name, (job) => handler(job), {
      connection: { url: this.redisUrl, maxRetriesPerRequest: null },
      concurrency,
    });
    this.worker.on('failed', (job, err) => {
      this.logger.error(`job ${job?.id} failed: ${err.message}`);
    });
  }

  async close(): Promise<void> {
    await Promise.all([this.worker?.close(), this.queue.close()]);
  }
}

/**
 * In-process queue with the same retry semantics as the BullMQ configuration
 * (3 attempts, exponential backoff). Jobs enqueued before a consumer registers
 * are buffered; duplicate jobIds of still-pending jobs are dropped, matching
 * BullMQ behaviour.
 */
export class MemoryJobQueue<T = unknown> implements JobQueue<T> {
  private readonly logger: Logger;
  private handler: ((job: JobContext<T>) => Promise<void>) | null = null;
  private readonly buffered: Array<{ data: T; jobId?: string }> = [];
  private readonly pendingIds = new Set<string>();
  private readonly timers = new Set<NodeJS.Timeout>();
  private closed = false;

  constructor(
    name: string,
    private readonly backoffMs: number = BACKOFF_MS,
  ) {
    this.logger = new Logger(`Queue:${name}(memory)`);
  }

  async add(_name: string, data: T, opts?: { jobId?: string }): Promise<void> {
    if (opts?.jobId) {
      if (this.pendingIds.has(opts.jobId)) return;
      this.pendingIds.add(opts.jobId);
    }
    if (!this.handler) {
      this.buffered.push({ data, jobId: opts?.jobId });
      return;
    }
    this.dispatch(data, opts?.jobId);
  }

  process(handler: (job: JobContext<T>) => Promise<void>): void {
    this.handler = handler;
    for (const job of this.buffered.splice(0)) this.dispatch(job.data, job.jobId);
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  private dispatch(data: T, jobId: string | undefined, attempt = 1): void {
    setImmediate(() => {
      void this.run(data, jobId, attempt);
    });
  }

  private async run(data: T, jobId: string | undefined, attempt: number): Promise<void> {
    if (this.closed || !this.handler) return;
    try {
      await this.handler({ data, updateProgress: async () => undefined });
      if (jobId) this.pendingIds.delete(jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt >= ATTEMPTS) {
        this.logger.error(`job ${jobId ?? '(anonymous)'} failed permanently: ${message}`);
        if (jobId) this.pendingIds.delete(jobId);
        return;
      }
      const delay = this.backoffMs * 2 ** (attempt - 1);
      this.logger.warn(`job ${jobId ?? '(anonymous)'} attempt ${attempt} failed, retrying in ${delay}ms: ${message}`);
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        void this.run(data, jobId, attempt + 1);
      }, delay);
      this.timers.add(timer);
    }
  }
}
