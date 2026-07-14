import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateProjectDto, Paginated, PaginationDto, UpdateProjectDto } from '@grillz/shared-types';
import type { Project } from '@grillz/database';
import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(ownerId: string, dto: CreateProjectDto): Promise<Project> {
    const project = await this.prisma.project.create({
      data: { ...dto, ownerId },
    });
    this.audit.record({
      actorId: ownerId,
      action: 'project.create',
      entityType: 'Project',
      entityId: project.id,
    });
    return project;
  }

  async list(ownerId: string, pagination: PaginationDto): Promise<Paginated<Project>> {
    const where = { ownerId, status: { not: 'ARCHIVED' as const } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        include: {
          scans: { select: { id: true, status: true, thumbnailKey: true, jaw: true } },
          _count: { select: { grillz: true, orders: true } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);
    return { items, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  /** Loads a project and enforces ownership (admins bypass). */
  async getOwned(projectId: string, userId: string, role: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        scans: { include: { teeth: true } },
        grillz: {
          include: { material: true, pattern: true, diamondSetting: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId && role !== 'ADMIN') {
      throw new ForbiddenException('Not your project');
    }
    return project;
  }

  async update(projectId: string, userId: string, role: string, dto: UpdateProjectDto) {
    await this.getOwned(projectId, userId, role);
    const project = await this.prisma.project.update({ where: { id: projectId }, data: dto });
    this.audit.record({
      actorId: userId,
      action: 'project.update',
      entityType: 'Project',
      entityId: projectId,
      metadata: { fields: Object.keys(dto) },
    });
    return project;
  }

  async archive(projectId: string, userId: string, role: string) {
    await this.getOwned(projectId, userId, role);
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'ARCHIVED' },
    });
    this.audit.record({
      actorId: userId,
      action: 'project.archive',
      entityType: 'Project',
      entityId: projectId,
    });
    return project;
  }
}
