import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REDIS, type RedisClient } from '../../infra/redis.module';
import { RATE_LIMIT_KEY, type AuthenticatedUser, type RateLimitOptions } from '../decorators';

const DEFAULT_LIMIT: RateLimitOptions = { limit: 120, windowSec: 60 };

/**
 * Redis fixed-window rate limiter. Keys on user id when authenticated,
 * remote IP otherwise, so the limit survives horizontal scaling of the API.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS) private readonly redis: RedisClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options =
      this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_LIMIT;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const subject = request.user?.id ?? requestIp(request);
    const route = `${request.method}:${request.route?.path ?? request.path}`;
    const window = Math.floor(Date.now() / (options.windowSec * 1000));
    const key = `rl:${subject}:${route}:${window}`;

    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, options.windowSec);

    if (count > options.limit) {
      throw new HttpException(
        { message: 'Too many requests', retryAfterSec: options.windowSec },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}

function requestIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim();
  }
  return request.socket.remoteAddress ?? 'unknown';
}
