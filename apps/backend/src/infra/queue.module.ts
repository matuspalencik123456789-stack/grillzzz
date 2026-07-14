import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES } from '@grillz/shared-types';
import { CONFIG, type AppConfig } from '../config/config';

export const SCAN_QUEUE = 'SCAN_QUEUE' as const;
export const RENDER_QUEUE = 'RENDER_QUEUE' as const;
export const NOTIFY_QUEUE = 'NOTIFY_QUEUE' as const;

function makeQueue(name: string, config: AppConfig): Queue {
  return new Queue(name, {
    connection: { url: config.REDIS_URL },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });
}

@Global()
@Module({
  providers: [
    {
      provide: SCAN_QUEUE,
      inject: [CONFIG],
      useFactory: (config: AppConfig) => makeQueue(QUEUES.scanPipeline, config),
    },
    {
      provide: RENDER_QUEUE,
      inject: [CONFIG],
      useFactory: (config: AppConfig) => makeQueue(QUEUES.rendering, config),
    },
    {
      provide: NOTIFY_QUEUE,
      inject: [CONFIG],
      useFactory: (config: AppConfig) => makeQueue(QUEUES.notifications, config),
    },
  ],
  exports: [SCAN_QUEUE, RENDER_QUEUE, NOTIFY_QUEUE],
})
export class QueueModule implements OnModuleDestroy {
  constructor(
    @Inject(SCAN_QUEUE) private readonly scanQueue: Queue,
    @Inject(RENDER_QUEUE) private readonly renderQueue: Queue,
    @Inject(NOTIFY_QUEUE) private readonly notifyQueue: Queue,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.scanQueue.close(), this.renderQueue.close(), this.notifyQueue.close()]);
  }
}
