import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CreateScanUploadDto,
  ScanPipelineJob,
  ScanUploadTicket,
} from '@grillz/shared-types';
import { PrismaService } from '../../infra/prisma.module';
import { StorageService } from '../../infra/storage.module';
import { SCAN_QUEUE } from '../../infra/queue.module';
import type { JobQueue } from '../../infra/job-queue';
import { AuditService } from '../audit/audit.service';

const EXTENSION_BY_FORMAT: Record<string, string[]> = {
  STL: ['stl'],
  PLY: ['ply'],
  OBJ: ['obj'],
  GLB: ['glb'],
  GLTF: ['gltf'],
};

@Injectable()
export class ScansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    @Inject(SCAN_QUEUE) private readonly scanQueue: JobQueue<ScanPipelineJob>,
  ) {}

  /**
   * Phase 1 of upload: validate intent, create the scan row in
   * AWAITING_UPLOAD, and issue a presigned PUT so the 10–200 MB file goes
   * browser → S3 without ever transiting the API.
   */
  async createUpload(userId: string, role: string, dto: CreateScanUploadDto): Promise<ScanUploadTicket> {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId && role !== 'ADMIN') throw new ForbiddenException('Not your project');

    const ext = dto.fileName.split('.').pop()?.toLowerCase() ?? '';
    if (!EXTENSION_BY_FORMAT[dto.format]?.includes(ext)) {
      throw new BadRequestException(`File extension .${ext} does not match format ${dto.format}`);
    }

    const fileKey = `scans/${dto.projectId}/${randomUUID()}.${ext}`;
    const scan = await this.prisma.dentalScan.create({
      data: {
        projectId: dto.projectId,
        name: dto.fileName,
        format: dto.format,
        jaw: dto.jawHint ?? 'UNKNOWN',
        originalFileKey: fileKey,
        fileSizeBytes: dto.fileSizeBytes,
      },
    });

    const uploadUrl = await this.storage.presignUpload(fileKey, dto.fileSizeBytes);
    this.audit.record({
      actorId: userId,
      action: 'scan.upload_start',
      entityType: 'DentalScan',
      entityId: scan.id,
      metadata: { fileName: dto.fileName, sizeBytes: dto.fileSizeBytes },
    });

    return { scanId: scan.id, uploadUrl, fileKey, expiresInSeconds: 900 };
  }

  /** Phase 2: client confirms the PUT completed; the pipeline job is enqueued. */
  async completeUpload(userId: string, role: string, scanId: string) {
    const scan = await this.getOwnedScan(scanId, userId, role);
    if (scan.status !== 'AWAITING_UPLOAD') {
      throw new BadRequestException(`Scan is ${scan.status}, not awaiting upload`);
    }

    const updated = await this.prisma.dentalScan.update({
      where: { id: scanId },
      data: { status: 'UPLOADED' },
    });

    const job: ScanPipelineJob = {
      scanId,
      fileKey: scan.originalFileKey,
      format: scan.format,
      jawHint: scan.jaw,
    };
    await this.scanQueue.add('process-scan', job, { jobId: `scan-${scanId}` });

    this.audit.record({
      actorId: userId,
      action: 'scan.upload_complete',
      entityType: 'DentalScan',
      entityId: scanId,
    });
    return updated;
  }

  async get(scanId: string, userId: string, role: string) {
    const scan = await this.getOwnedScan(scanId, userId, role, { teeth: true });
    return scan;
  }

  /** Presigned GET for the processed GLB the viewer streams. */
  async getMeshUrl(scanId: string, userId: string, role: string) {
    const scan = await this.getOwnedScan(scanId, userId, role);
    if (!scan.processedGlbKey) throw new BadRequestException('Scan is not processed yet');
    const url = await this.storage.presignDownload(scan.processedGlbKey, 3600);
    return { url, expiresInSeconds: 3600 };
  }

  async getThumbnailUrl(scanId: string, userId: string, role: string) {
    const scan = await this.getOwnedScan(scanId, userId, role);
    if (!scan.thumbnailKey) throw new BadRequestException('Thumbnail not generated yet');
    const url = await this.storage.presignDownload(scan.thumbnailKey, 3600);
    return { url, expiresInSeconds: 3600 };
  }

  async remove(scanId: string, userId: string, role: string) {
    const scan = await this.getOwnedScan(scanId, userId, role);
    await this.prisma.dentalScan.delete({ where: { id: scanId } });
    // best-effort blob cleanup; DB row is the source of truth
    await Promise.allSettled([
      this.storage.deleteObject(scan.originalFileKey),
      scan.processedGlbKey ? this.storage.deleteObject(scan.processedGlbKey) : Promise.resolve(),
      scan.thumbnailKey ? this.storage.deleteObject(scan.thumbnailKey) : Promise.resolve(),
    ]);
    this.audit.record({
      actorId: userId,
      action: 'scan.delete',
      entityType: 'DentalScan',
      entityId: scanId,
    });
  }

  private async getOwnedScan(
    scanId: string,
    userId: string,
    role: string,
    include?: { teeth: boolean },
  ) {
    const scan = await this.prisma.dentalScan.findUnique({
      where: { id: scanId },
      include: { project: { select: { ownerId: true } }, ...(include ?? {}) },
    });
    if (!scan) throw new NotFoundException('Scan not found');
    if (scan.project.ownerId !== userId && role !== 'ADMIN') {
      throw new ForbiddenException('Not your scan');
    }
    return scan;
  }
}
