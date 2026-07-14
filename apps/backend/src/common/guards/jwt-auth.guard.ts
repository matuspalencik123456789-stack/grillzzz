import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY, type AuthenticatedUser } from '../decorators';
import { roleSchema } from '@grillz/shared-types';
import { z } from 'zod';

export const accessTokenPayloadSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  role: roleSchema,
  type: z.literal('access'),
});
export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let payload: unknown;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const parsed = accessTokenPayloadSchema.safeParse(payload);
    if (!parsed.success) throw new UnauthorizedException('Malformed token payload');

    request.user = {
      id: parsed.data.sub,
      email: parsed.data.email,
      role: parsed.data.role,
    };
    return true;
  }
}
