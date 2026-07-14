import { Body, Controller, Get, HttpCode, Param, Patch, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  materialTypeSchema,
  orderStatusSchema,
  paginationSchema,
  roleSchema,
} from '@grillz/shared-types';
import { AdminService } from './admin.service';
import { CurrentUser, Roles, type AuthenticatedUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

const userListQuery = paginationSchema.extend({ q: z.string().max(120).optional() });
const orderListQuery = paginationSchema.extend({ status: orderStatusSchema.optional() });
const auditQuery = paginationSchema.extend({ entityType: z.string().max(40).optional() });
const setRoleSchema = z.object({ role: roleSchema });
const setActiveSchema = z.object({ isActive: z.boolean() });
const updateMaterialSchema = z.object({
  pricePerGram: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});
const updatePatternSchema = z.object({
  laborFactor: z.number().min(0.5).max(5).optional(),
  isActive: z.boolean().optional(),
});

@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users(@Query(new ZodValidationPipe(userListQuery)) query: z.infer<typeof userListQuery>) {
    return this.admin.listUsers(query.page, query.pageSize, query.q);
  }

  @HttpCode(200)
  @Patch('users/:id/role')
  setRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setRoleSchema)) dto: z.infer<typeof setRoleSchema>,
  ) {
    return this.admin.setUserRole(user.id, id, dto.role);
  }

  @HttpCode(200)
  @Patch('users/:id/active')
  setActive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setActiveSchema)) dto: z.infer<typeof setActiveSchema>,
  ) {
    return this.admin.setUserActive(user.id, id, dto.isActive);
  }

  @Get('orders')
  orders(@Query(new ZodValidationPipe(orderListQuery)) query: z.infer<typeof orderListQuery>) {
    return this.admin.listOrders(query.page, query.pageSize, query.status);
  }

  @HttpCode(200)
  @Patch('materials/:type')
  updateMaterial(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type', new ZodValidationPipe(materialTypeSchema)) type: z.infer<typeof materialTypeSchema>,
    @Body(new ZodValidationPipe(updateMaterialSchema)) dto: z.infer<typeof updateMaterialSchema>,
  ) {
    return this.admin.updateMaterial(user.id, type, dto);
  }

  @HttpCode(200)
  @Patch('patterns/:id')
  updatePattern(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePatternSchema)) dto: z.infer<typeof updatePatternSchema>,
  ) {
    return this.admin.updatePattern(user.id, id, dto);
  }

  @Get('analytics')
  analytics() {
    return this.admin.analytics();
  }

  @Get('audit')
  audit(@Query(new ZodValidationPipe(auditQuery)) query: z.infer<typeof auditQuery>) {
    return this.admin.auditTrail(query.page, query.pageSize, query.entityType);
  }
}
