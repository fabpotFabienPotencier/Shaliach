import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  Res,
  UsePipes,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { LeadsService } from './leads.service';
import {
  LeadFilterDto,
  LeadFilterSchema,
  UpdateLeadDto,
  UpdateLeadSchema,
  BulkLeadActionDto,
  BulkLeadActionSchema,
} from './leads.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/leads')
export class LeadsController {
  constructor(private leadsService: LeadsService) {}

  @Get()
  async listLeads(@Query() query: any) {
    const filter = LeadFilterSchema.parse(query);
    return this.leadsService.listLeads(filter);
  }

  @Get('export')
  async exportLeads(@Query() query: any, @Res() reply: FastifyReply) {
    const filter = LeadFilterSchema.parse(query);
    const csvContent = await this.leadsService.exportLeadsCsv(filter);

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="fixhubtech_leads_export.csv"')
      .send(csvContent);
  }

  @Get(':id')
  async getLead(@Param('id') id: string) {
    return this.leadsService.getLeadById(id);
  }

  @Put(':id')
  async updateLead(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateLeadSchema)) dto: UpdateLeadDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.updateLead(id, dto, user?.id);
  }

  @Post('bulk')
  async bulkAction(
    @Body(new ZodValidationPipe(BulkLeadActionSchema)) dto: BulkLeadActionDto,
    @CurrentUser() user: any,
  ) {
    return this.leadsService.bulkAction(dto, user?.id);
  }
}
