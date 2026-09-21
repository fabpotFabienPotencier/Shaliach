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
import { CampaignsService } from './campaigns.service';
import {
  CreateCampaignDto,
  CreateCampaignSchema,
  UpdateCampaignDto,
  UpdateCampaignSchema,
  CampaignStatusActionDto,
  CampaignStatusActionSchema,
} from './campaigns.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/campaigns')
export class CampaignsController {
  constructor(private campaignsService: CampaignsService) {}

  @Get()
  async listCampaigns(@Query('limit') limit = '20', @Query('offset') offset = '0') {
    return this.campaignsService.listCampaigns(parseInt(limit, 10), parseInt(offset, 10));
  }

  @Get(':id')
  async getCampaign(@Param('id') id: string) {
    return this.campaignsService.getCampaignById(id);
  }

  @Post()
  async createCampaign(
    @Body(new ZodValidationPipe(CreateCampaignSchema)) dto: CreateCampaignDto,
    @CurrentUser() user: any,
  ) {
    return this.campaignsService.createCampaign(dto, user?.id);
  }

  @Put(':id')
  async updateCampaign(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCampaignSchema)) dto: UpdateCampaignDto,
    @CurrentUser() user: any,
  ) {
    return this.campaignsService.updateCampaign(id, dto, user?.id);
  }

  @Post(':id/action')
  async handleAction(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CampaignStatusActionSchema)) dto: CampaignStatusActionDto,
    @CurrentUser() user: any,
  ) {
    return this.campaignsService.handleStatusAction(id, dto, user?.id);
  }
}
