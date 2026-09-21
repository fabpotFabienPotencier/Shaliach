import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApprovalService } from './approval.service';
import {
  ApprovalActionDto,
  ApprovalActionSchema,
  BulkApprovalActionDto,
  BulkApprovalActionSchema,
  EditDraftDto,
  EditDraftSchema,
} from './approval.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/approval')
export class ApprovalController {
  constructor(private approvalService: ApprovalService) {}

  @Get()
  async listQueue(
    @Query('campaignId') campaignId?: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return this.approvalService.listApprovalQueue(
      campaignId,
      parseInt(limit, 10),
      parseInt(offset, 10),
    );
  }

  @Put(':id/draft')
  async editDraft(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EditDraftSchema)) dto: EditDraftDto,
    @CurrentUser() user: any,
  ) {
    return this.approvalService.editDraft(id, dto, user?.id);
  }

  @Post(':id/action')
  async handleAction(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ApprovalActionSchema)) dto: ApprovalActionDto,
    @CurrentUser() user: any,
  ) {
    return this.approvalService.handleAction(id, dto, user?.id);
  }

  @Post('bulk')
  async bulkAction(
    @Body(new ZodValidationPipe(BulkApprovalActionSchema)) dto: BulkApprovalActionDto,
    @CurrentUser() user: any,
  ) {
    return this.approvalService.bulkAction(dto, user?.id);
  }
}
