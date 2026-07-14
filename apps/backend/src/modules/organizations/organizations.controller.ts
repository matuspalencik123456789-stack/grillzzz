import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { OrganizationsService } from './organizations.service';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

const createOrgSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  type: z.enum(['STUDIO', 'MANUFACTURER']),
});

const addMemberSchema = z.object({ email: z.string().email() });

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createOrgSchema)) dto: z.infer<typeof createOrgSchema>,
  ) {
    return this.orgs.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.orgs.listForUser(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orgs.getForMember(id, user.id);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addMemberSchema)) dto: z.infer<typeof addMemberSchema>,
  ) {
    return this.orgs.addMember(id, user.id, dto.email);
  }
}
