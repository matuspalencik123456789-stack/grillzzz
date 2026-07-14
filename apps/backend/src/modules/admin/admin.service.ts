import { Injectable, NotFoundException } from '@nestjs/common';
import type { MaterialType, OrderStatus, Role } from '@grillz/database';
import { PrismaService } from '../../infra/prisma.module';
import { CatalogService } from '../catalog/catalog.service';
import { PricingService } from '../pricing/pricing.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
  ) {}

  // ── users ────────────────────────────────────────────────────────────────

  async listUsers(page: number, pageSize: number, query?: string) {
    const where = query
      ? {
          OR: [
            { email: { contains: query, mode: 'insensitive' as const } },
            { name: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: { select: { projects: true, orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async setUserRole(actorId: string, userId: string, role: Role) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { role } });
    this.audit.record({
      actorId,
      action: 'admin.user.set_role',
      entityType: 'User',
      entityId: userId,
      metadata: { role },
    });
    return { id: user.id, role: user.role };
  }

  async setUserActive(actorId: string, userId: string, isActive: boolean) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { isActive } });
    if (!isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    this.audit.record({
      actorId,
      action: isActive ? 'admin.user.enable' : 'admin.user.disable',
      entityType: 'User',
      entityId: userId,
    });
    return { id: user.id, isActive: user.isActive };
  }

  // ── orders ───────────────────────────────────────────────────────────────

  async listOrders(page: number, pageSize: number, status?: OrderStatus) {
    const where = status ? { status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true } },
          items: { include: { grillz: { select: { id: true, name: true } } } },
          productionJob: { select: { id: true, stage: true } },
        },
        orderBy: { placedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  // ── pricing / materials (inventory) ─────────────────────────────────────

  async updateMaterial(
    actorId: string,
    materialType: MaterialType,
    data: { pricePerGram?: number; isActive?: boolean },
  ) {
    const material = await this.prisma.material.findUnique({ where: { type: materialType } });
    if (!material) throw new NotFoundException(`Material ${materialType} not found`);
    const updated = await this.prisma.material.update({
      where: { type: materialType },
      data,
    });
    await Promise.all([this.catalog.bustCache(), this.pricing.bustCache()]);
    this.audit.record({
      actorId,
      action: 'admin.material.update',
      entityType: 'Material',
      entityId: material.id,
      metadata: data,
    });
    return updated;
  }

  async updatePattern(actorId: string, patternId: string, data: { laborFactor?: number; isActive?: boolean }) {
    const updated = await this.prisma.pattern.update({ where: { id: patternId }, data });
    await Promise.all([this.catalog.bustCache(), this.pricing.bustCache()]);
    this.audit.record({
      actorId,
      action: 'admin.pattern.update',
      entityType: 'Pattern',
      entityId: patternId,
      metadata: data,
    });
    return updated;
  }

  // ── analytics ────────────────────────────────────────────────────────────

  async analytics() {
    const since30d = new Date(Date.now() - 30 * 86_400_000);
    const [users, projects, scans, orders, revenueAgg, recentOrders] =
      await this.prisma.$transaction([
        this.prisma.user.count(),
        this.prisma.project.count(),
        this.prisma.dentalScan.count({ where: { status: 'READY' } }),
        this.prisma.order.count(),
        this.prisma.order.aggregate({
          _sum: { totalMinor: true },
          where: { status: { in: ['PAID', 'IN_PRODUCTION', 'QUALITY_CHECK', 'SHIPPED', 'DELIVERED'] } },
        }),
        this.prisma.order.count({ where: { placedAt: { gte: since30d } } }),
      ]);

    const stageCounts = await this.prisma.productionJob.groupBy({
      by: ['stage'],
      _count: { _all: true },
      orderBy: { stage: 'asc' },
    });
    const materialsPopularity = await this.prisma.grillz.groupBy({
      by: ['materialId'],
      _count: { _all: true },
      orderBy: { _count: { materialId: 'desc' } },
      take: 7,
    });
    const materialRows = await this.prisma.material.findMany({
      where: { id: { in: materialsPopularity.map((m) => m.materialId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(materialRows.map((m) => [m.id, m.name]));

    return {
      totals: {
        users,
        projects,
        readyScans: scans,
        orders,
        revenueMinor: revenueAgg._sum.totalMinor ?? 0,
        ordersLast30d: recentOrders,
      },
      productionByStage: Object.fromEntries(stageCounts.map((s) => [s.stage, s._count._all])),
      popularMaterials: materialsPopularity.map((m) => ({
        material: nameById.get(m.materialId) ?? m.materialId,
        designs: m._count._all,
      })),
    };
  }

  async auditTrail(page: number, pageSize: number, entityType?: string) {
    const where = entityType ? { entityType } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
