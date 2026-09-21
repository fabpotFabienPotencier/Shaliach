import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis.service';
import { ErrorCode } from '@shaliach/shared';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const sessionId =
      request.cookies?.shaliach_session ||
      request.headers?.['x-session-id'] ||
      (request.headers?.authorization?.startsWith('Bearer ')
        ? request.headers.authorization.substring(7)
        : null);

    if (!sessionId) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Authentication session required',
      });
    }

    // Check session in Redis cache first
    const cachedUserId = await this.redis.get(`session:${sessionId}`);
    let userId = cachedUserId;

    if (!userId) {
      // Session expired or not in Redis
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_SESSION_EXPIRED,
        message: 'Session has expired or is invalid. Please log in again.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'User account is inactive or not found',
      });
    }

    request.user = user;
    request.sessionId = sessionId;
    return true;
  }
}
