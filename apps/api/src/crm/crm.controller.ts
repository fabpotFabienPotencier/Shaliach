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
import { CrmService } from './crm.service';
import {
  UpdateLeadCrmStageDto,
  UpdateLeadCrmStageSchema,
  AddRevenueEntryDto,
  AddRevenueEntrySchema,
} from './crm.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CrmStatus } from '@shaliach/shared';

@Controller('api/crm')
export class CrmController {
  constructor(private crmService: CrmService) {}

  @Get('summary')
  async getSummary() {
    return this.crmService.getPipelineSummary();
  }

  @Get('stage/:stage')
  async getByStage(
    @Param('stage') stage: CrmStatus,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return this.crmService.getLeadsByStage(stage, parseInt(limit, 10), parseInt(offset, 10));
  }

  @Put('leads/:id/stage')
  async updateStage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateLeadCrmStageSchema)) dto: UpdateLeadCrmStageDto,
    @CurrentUser() user: any,
  ) {
    return this.crmService.updateLeadStage(id, dto, user?.id);
  }

  @Post('revenue')
  async recordRevenue(
    @Body(new ZodValidationPipe(AddRevenueEntrySchema)) dto: AddRevenueEntryDto,
    @CurrentUser() user: any,
  ) {
    return this.crmService.addRevenue(dto, user?.id);
  }
}
