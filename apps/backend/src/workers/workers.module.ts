import { Module } from '@nestjs/common';
import { ScanPipelineWorker } from './scan-pipeline.worker';
import { NotificationsModule } from '../modules/notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [ScanPipelineWorker],
})
export class WorkersModule {}
