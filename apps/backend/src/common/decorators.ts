import {
  createParamDecorator,
  SetMetadata,
  type CustomDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { Role } from '@grillz/shared-types';

export const IS_PUBLIC_KEY = 'isPublic';
/** Route is reachable without authentication. */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Route requires one of the given roles (JwtAuthGuard must run first). */
export const Roles = (...roles: Role[]): CustomDecorator => SetMetadata(ROLES_KEY, roles);

export const RATE_LIMIT_KEY = 'rateLimit';
export interface RateLimitOptions {
  /** requests allowed per window */
  limit: number;
  /** window in seconds */
  windowSec: number;
}
/** Override the default rate limit for a route (e.g. tighter on login). */
export const RateLimit = (options: RateLimitOptions): CustomDecorator =>
  SetMetadata(RATE_LIMIT_KEY, options);

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!request.user) throw new Error('CurrentUser used on an unauthenticated route');
    return request.user;
  },
);
