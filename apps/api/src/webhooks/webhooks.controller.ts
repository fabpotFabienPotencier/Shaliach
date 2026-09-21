import { Controller, Post, Req, Res, HttpStatus } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { WebhooksService } from './webhooks.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Public()
  @Post('resend')
  async handleResendWebhook(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const rawPayload =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const parsedBody = req.body;
    const headers = req.headers as Record<string, string>;

    const result = await this.webhooksService.processIncomingWebhook(
      rawPayload,
      parsedBody,
      headers,
    );

    return reply.status(HttpStatus.OK).send(result);
  }
}
