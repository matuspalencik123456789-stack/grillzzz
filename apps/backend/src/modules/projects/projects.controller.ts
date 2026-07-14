import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createProjectSchema,
  paginationSchema,
  updateProjectSchema,
  type CreateProjectDto,
  type PaginationDto,
  type UpdateProjectDto,
} from '@grillz/shared-types';
import { ProjectsService } from './projects.service';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProjectSchema)) dto: CreateProjectDto,
  ) {
    return this.projects.create(user.id, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(paginationSchema)) pagination: PaginationDto,
  ) {
    return this.projects.list(user.id, pagination);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projects.getOwned(id, user.id, user.role);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) dto: UpdateProjectDto,
  ) {
    return this.projects.update(id, user.id, user.role, dto);
  }

  @Delete(':id')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projects.archive(id, user.id, user.role);
  }
}
