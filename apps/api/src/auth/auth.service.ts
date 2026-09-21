import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../redis.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto, ChangePasswordDto } from './auth.dto';
import { ErrorCode } from '@shaliach/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private audit: AuditService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      this.logger.warn(`Failed login attempt for email: ${dto.email} from IP: ${ipAddress}`);
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'Invalid email address or password',
      });
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`Failed login password for user: ${user.email} from IP: ${ipAddress}`);
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'Invalid email address or password',
      });
    }

    // Generate secure random session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    await this.redis.set(`session:${sessionId}`, user.id, this.SESSION_TTL_SECONDS);

    await this.audit.log({
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    this.logger.log(`Successful login for user: ${user.email}`);

    return {
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async logout(sessionId: string, userId?: string, ipAddress?: string) {
    if (sessionId) {
      await this.redis.del(`session:${sessionId}`);
    }

    if (userId) {
      await this.audit.log({
        userId,
        action: 'USER_LOGOUT',
        entityType: 'User',
        entityId: userId,
        ipAddress,
      });
    }

    return { success: true, message: 'Logged out successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'User not found',
      });
    }

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Current password does not match',
      });
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await this.audit.log({
      userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: userId,
      ipAddress,
    });

    return { success: true, message: 'Password changed successfully' };
  }
}
