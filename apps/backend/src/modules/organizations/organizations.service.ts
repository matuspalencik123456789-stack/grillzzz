import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { OrganizationType } from '@grillz/database';
import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(ownerId: string, input: { name: string; slug: string; type: OrganizationType }) {
    const existing = await this.prisma.organization.findUnique({ where: { slug: input.slug } });
    if (existing) throw new ConflictException('Slug already taken');

    const org = await this.prisma.organization.create({
      data: {
        ...input,
        members: { create: { userId: ownerId, role: 'OWNER' } },
      },
      include: { members: true },
    });
    this.audit.record({
      actorId: ownerId,
      action: 'organization.create',
      entityType: 'Organization',
      entityId: org.id,
    });
    return org;
  }

  async listForUser(userId: string) {
    return this.prisma.organization.findMany({
      where: { members: { some: { userId } }, isActive: true },
      include: { _count: { select: { members: true, projects: true } } },
    });
  }

  async getForMember(orgId: string, userId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.members.some((m) => m.userId === userId)) {
      throw new ForbiddenException('Not a member of this organization');
    }
    return org;
  }

  async addMember(orgId: string, actingUserId: string, targetEmail: string) {
    await this.assertRole(orgId, actingUserId, ['OWNER', 'MANAGER']);
    const target = await this.prisma.user.findUnique({ where: { email: targetEmail } });
    if (!target) throw new NotFoundException('No user with that email');

    const member = await this.prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId: target.id } },
      update: {},
      create: { organizationId: orgId, userId: target.id },
    });
    this.audit.record({
      actorId: actingUserId,
      action: 'organization.member_add',
      entityType: 'Organization',
      entityId: orgId,
      metadata: { targetUserId: target.id },
    });
    return member;
  }

  private async assertRole(orgId: string, userId: string, roles: Array<'OWNER' | 'MANAGER' | 'TECHNICIAN'>) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
    if (!membership || !roles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient organization role');
    }
  }
}
