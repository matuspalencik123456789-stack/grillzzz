import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@grillz/database';
import {
  clampGrillzConfig,
  type CreateGrillzDto,
  type GrillzConfig,
  type UpdateGrillzDto,
} from '@grillz/shared-types';
import { estimateFacialAreaMm2 } from '@grillz/pricing-engine';
import { PrismaService } from '../../infra/prisma.module';
import { PricingService } from '../pricing/pricing.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class GrillzService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, role: string, dto: CreateGrillzDto) {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId && role !== 'ADMIN') throw new ForbiddenException('Not your project');

    const config = clampGrillzConfig(dto.config);
    const material = await this.materialFor(config);

    const grillz = await this.prisma.grillz.create({
      data: {
        projectId: dto.projectId,
        name: dto.name,
        materialId: material.id,
        ...this.denormalize(config),
        configJson: config as unknown as Prisma.InputJsonValue,
      },
      include: { material: true, pattern: true, diamondSetting: true },
    });

    await this.syncDiamondSetting(grillz.id, config);
    this.audit.record({
      actorId: userId,
      action: 'grillz.create',
      entityType: 'Grillz',
      entityId: grillz.id,
    });
    return this.getOwned(grillz.id, userId, role);
  }

  async update(grillzId: string, userId: string, role: string, dto: UpdateGrillzDto) {
    const existing = await this.getOwned(grillzId, userId, role);
    if (existing.status === 'LOCKED' || existing.status === 'IN_PRODUCTION') {
      throw new BadRequestException(`Design is ${existing.status} and can no longer be edited`);
    }

    let data: Prisma.GrillzUpdateInput = { name: dto.name ?? undefined };
    if (dto.config) {
      const config = clampGrillzConfig(dto.config);
      const material = await this.materialFor(config);
      data = {
        ...data,
        ...this.denormalize(config),
        material: { connect: { id: material.id } },
        configJson: config as unknown as Prisma.InputJsonValue,
        status: 'DRAFT', // any edit invalidates a previous quote
        priceSnapshot: Prisma.DbNull,
      };
      await this.syncDiamondSetting(grillzId, config);
    }

    await this.prisma.grillz.update({ where: { id: grillzId }, data });
    this.audit.record({
      actorId: userId,
      action: 'grillz.update',
      entityType: 'Grillz',
      entityId: grillzId,
    });
    return this.getOwned(grillzId, userId, role);
  }

  /** Computes and persists the authoritative quote for a design. */
  async priceDesign(grillzId: string, userId: string, role: string, countryCode = 'US', expedited = false) {
    const grillz = await this.getOwned(grillzId, userId, role);
    const config = grillz.configJson as unknown as GrillzConfig;

    const facialArea = await this.facialAreaFor(grillz.projectId, config);
    const quote = await this.pricing.quote({
      config,
      facialSurfaceAreaMm2: facialArea,
      countryCode,
      expedited,
    });

    await this.prisma.grillz.update({
      where: { id: grillzId },
      data: { priceSnapshot: quote as unknown as Prisma.InputJsonValue, status: 'PRICED' },
    });
    this.audit.record({
      actorId: userId,
      action: 'grillz.price',
      entityType: 'Grillz',
      entityId: grillzId,
      metadata: { totalMinor: quote.totalMinor, priceBookVersion: quote.priceBookVersion },
    });
    return quote;
  }

  async getOwned(grillzId: string, userId: string, role: string) {
    const grillz = await this.prisma.grillz.findUnique({
      where: { id: grillzId },
      include: {
        material: true,
        pattern: true,
        diamondSetting: true,
        project: { select: { id: true, ownerId: true, name: true } },
      },
    });
    if (!grillz) throw new NotFoundException('Design not found');
    if (grillz.project.ownerId !== userId && role !== 'ADMIN') {
      throw new ForbiddenException('Not your design');
    }
    return grillz;
  }

  async listForUser(userId: string) {
    return this.prisma.grillz.findMany({
      where: { project: { ownerId: userId } },
      include: { material: true, pattern: true, project: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async toggleFavorite(grillzId: string, userId: string, role: string) {
    await this.getOwned(grillzId, userId, role);
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_grillzId: { userId, grillzId } },
    });
    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      return { favorite: false };
    }
    await this.prisma.favorite.create({ data: { userId, grillzId } });
    return { favorite: true };
  }

  async listFavorites(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: {
        grillz: { include: { material: true, project: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Facial surface area from the project's segmented scan; falls back to the
   * statistical estimate when the design covers teeth not present in a scan.
   */
  async facialAreaFor(projectId: string, config: GrillzConfig): Promise<number> {
    const teeth = await this.prisma.tooth.findMany({
      where: {
        scan: { projectId, status: 'READY' },
        fdiNumber: { in: config.toothNumbers },
      },
    });
    if (teeth.length === 0) return estimateFacialAreaMm2(config.toothNumbers.length);

    const known = teeth.reduce((s, t) => s + t.surfaceAreaMm2, 0);
    const missing = config.toothNumbers.length - teeth.length;
    return known + estimateFacialAreaMm2(Math.max(0, missing));
  }

  private async materialFor(config: GrillzConfig) {
    const material = await this.prisma.material.findUnique({ where: { type: config.material } });
    if (!material || !material.isActive) {
      throw new BadRequestException(`Material ${config.material} is not available`);
    }
    return material;
  }

  private denormalize(config: GrillzConfig) {
    return {
      setType: config.setType,
      toothNumbers: config.toothNumbers,
      finish: config.finish,
      thicknessMm: config.geometry.thicknessMm,
      offsetMm: config.geometry.offsetMm,
      fitToleranceMm: config.geometry.fitToleranceMm,
      chamferMm: config.geometry.chamferMm,
      edgeRadiusMm: config.geometry.edgeRadiusMm,
      engravingText: config.engravingText ?? null,
    };
  }

  /** DiamondSetting + Pattern rows mirror the config for the manufacturer work order. */
  private async syncDiamondSetting(grillzId: string, config: GrillzConfig): Promise<void> {
    if (config.diamonds.enabled) {
      const data = {
        stoneType: config.diamonds.stoneType,
        shape: config.diamonds.shape,
        stoneSizeMm: config.diamonds.stoneSizeMm,
        spacingMm: config.diamonds.spacingMm,
        density: config.diamonds.density,
      };
      await this.prisma.diamondSetting.upsert({
        where: { grillzId },
        update: data,
        create: { grillzId, ...data },
      });
    } else {
      await this.prisma.diamondSetting.deleteMany({ where: { grillzId } });
    }

    const pattern = await this.prisma.pattern.findUnique({ where: { kind: config.pattern } });
    await this.prisma.grillz.update({
      where: { id: grillzId },
      data: { patternId: pattern?.id ?? null },
    });
  }
}
