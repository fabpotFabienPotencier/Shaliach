import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UsePipes,
  HttpStatus,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { LoginDto, LoginSchema, ChangePasswordDto, ChangePasswordSchema } from './auth.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.login(dto, ip, userAgent);

    // Set secure HTTP-only cookie
    reply.setCookie('shaliach_session', result.sessionId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return reply.status(HttpStatus.OK).send({
      success: true,
      user: result.user,
      sessionId: result.sessionId,
    });
  }

  @Post('logout')
  async logout(
    @Req() req: any,
    @Res() reply: FastifyReply,
    @CurrentUser() user: any,
  ) {
    const sessionId = req.sessionId;
    const ip = req.ip || req.socket?.remoteAddress;

    await this.authService.logout(sessionId, user?.id, ip);

    reply.clearCookie('shaliach_session', { path: '/' });
    return reply.status(HttpStatus.OK).send({
      success: true,
      message: 'Logged out successfully',
    });
  }

  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    return {
      success: true,
      user,
    };
  }

  @Post('change-password')
  @UsePipes(new ZodValidationPipe(ChangePasswordSchema))
  async changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
    @Req() req: FastifyRequest,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    return this.authService.changePassword(user.id, dto, ip);
  }
}
