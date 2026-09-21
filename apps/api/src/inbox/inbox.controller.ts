import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UsePipes,
} from '@nestjs/common';
import { InboxService } from './inbox.service';
import { SendReplyDto, SendReplySchema } from './inbox.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/inbox')
export class InboxController {
  constructor(private inboxService: InboxService) {}

  @Get()
  async listConversations(
    @Query('limit') limit = '30',
    @Query('offset') offset = '0',
  ) {
    return this.inboxService.listConversations(
      parseInt(limit, 10),
      parseInt(offset, 10),
    );
  }

  @Get(':id')
  async getConversation(@Param('id') id: string) {
    return this.inboxService.getConversationById(id);
  }

  @Post(':id/reply')
  async sendReply(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SendReplySchema)) dto: SendReplyDto,
    @CurrentUser() user: any,
  ) {
    return this.inboxService.sendReply(id, dto, user?.id);
  }
}
