import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { Prisma } from '@grillz/database';
import { exportGlb, processScan } from '@grillz/cad-engine';
import { QUEUES, type ScanPipelineJob } from '@grillz/shared-types';
import { PrismaService } from '../infra/prisma.module';
import { StorageService } from '../infra/storage.module';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { CONFIG, type AppConfig } from '../config/config';
import { renderMeshThumbnail } from './render/rasterize';

const STAGE_TO_STATUS = {
  VALIDATING: 'VALIDATING',
  OPTIMIZING: 'OPTIMIZING',
  ANALYZING: 'ANALYZING',
  SEGMENTING: 'SEGMENTING',
} as const;

/**
 * BullMQ consumer for the scan-intake pipeline. Runs in-process with the API
 * by default; because it is plain BullMQ, scaling out is deploying the same
 * image with only this module enabled and more replicas.
 */
@Injectable()
export class ScanPipelineWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanPipelineWorker.name);
  private worker: Worker<ScanPipelineJob> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<ScanPipelineJob>(
      QUEUES.scanPipeline,
      (job) => this.process(job),
      {
        connection: { url: this.config.REDIS_URL, maxRetriesPerRequest: null },
        concurrency: 2, // mesh processing is CPU-bound
      },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`scan job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<ScanPipelineJob>): Promise<void> {
    const { scanId, fileKey, format, jawHint } = job.data;
    const scan = await this.prisma.dentalScan.findUnique({
      where: { id: scanId },
      include: { project: { select: { ownerId: true, name: true } } },
    });
    if (!scan) {
      this.logger.warn(`scan ${scanId} vanished before processing`);
      return;
    }

    try {
      const data = await this.storage.getObject(fileKey);

      const result = await processScan(data, format, {
        jawHint: jawHint === 'UNKNOWN' ? undefined : jawHint,
        onStage: async (stage) => {
          await this.prisma.dentalScan.update({
            where: { id: scanId },
            data: { status: STAGE_TO_STATUS[stage] },
          });
          await job.updateProgress({ stage });
        },
      });

      // processed GLB — the exact geometry the viewer streams (tooth ranges valid)
      const glb = exportGlb(result.mesh, { name: scan.name, baseColorHex: '#f2efe9', metallic: 0, roughness: 0.6 });
      const glbKey = `scans/processed/${scanId}.glb`;
      await this.storage.putObject(glbKey, glb, 'model/gltf-binary');

      // automatic thumbnail
      const png = renderMeshThumbnail(result.mesh, {
        width: 512,
        height: 512,
        colorHex: '#e8e4dc',
        backgroundHex: '#101013',
      });
      const thumbnailKey = `scans/thumbnails/${scanId}.png`;
      await this.storage.putObject(thumbnailKey, png, 'image/png');

      await this.prisma.$transaction([
        this.prisma.tooth.deleteMany({ where: { scanId } }),
        this.prisma.tooth.createMany({
          data: result.teeth.map((tooth) => ({
            scanId,
            fdiNumber: tooth.fdiNumber,
            centroid: tooth.centroid as unknown as Prisma.InputJsonValue,
            boundingBox: tooth.boundingBox as unknown as Prisma.InputJsonValue,
            surfaceAreaMm2: tooth.surfaceAreaMm2,
            triangleRange: tooth.triangleRange as unknown as Prisma.InputJsonValue,
            confidence: tooth.confidence,
          })),
        }),
        this.prisma.dentalScan.update({
          where: { id: scanId },
          data: {
            status: 'READY',
            jaw: result.jaw.jaw,
            processedGlbKey: glbKey,
            thumbnailKey,
            meshStats: result.stats as unknown as Prisma.InputJsonValue,
            boundingBox: result.boundingBox as unknown as Prisma.InputJsonValue,
            errorMessage:
              result.warnings.length > 0
                ? `Warnings: ${result.warnings.map((w) => w.message).join('; ')}`
                : null,
          },
        }),
      ]);

      await this.notifications.notify(scan.project.ownerId, {
        type: 'SCAN_READY',
        title: `Scan "${scan.name}" is ready`,
        body: `${result.teeth.length} teeth detected (${result.jaw.jaw.toLowerCase()} jaw). Open the studio to start designing.`,
        data: { scanId, projectId: scan.projectId },
      });
      this.logger.log(
        `scan ${scanId}: ${result.stats.triangleCount} tris, ${result.teeth.length} teeth, jaw=${result.jaw.jaw}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown processing error';
      await this.prisma.dentalScan.update({
        where: { id: scanId },
        data: { status: 'FAILED', errorMessage: message },
      });
      await this.notifications.notify(scan.project.ownerId, {
        type: 'SCAN_FAILED',
        title: `Scan "${scan.name}" could not be processed`,
        body: message,
        data: { scanId, projectId: scan.projectId },
      });
      throw err; // let BullMQ retry policy decide
    }
  }
}
