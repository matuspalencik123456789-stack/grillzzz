import { Body, Controller, Get, Patch } from '@nestjs/common';
import { z } from 'zod';
import { UsersService } from './users.service';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

const updateProfileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  image: z.string().url().optional(),
});

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getById(user.id);
  }

  @Patch('me')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: z.infer<typeof updateProfileSchema>,
  ) {
    return this.users.updateProfile(user.id, dto);
  }
}
