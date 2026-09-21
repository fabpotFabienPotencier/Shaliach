import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UsePipes,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { SuppressionService } from './suppression.service';
import { AddSuppressionDto, AddSuppressionSchema } from './suppression.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/suppression')
export class SuppressionController {
  constructor(private suppressionService: SuppressionService) {}

  @Get()
  async listSuppression(
    @Query('search') search?: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return this.suppressionService.listSuppressed(
      search,
      parseInt(limit, 10),
      parseInt(offset, 10),
    );
  }

  @Post()
  async addSuppression(
    @Body(new ZodValidationPipe(AddSuppressionSchema)) dto: AddSuppressionDto,
    @CurrentUser() user: any,
  ) {
    return this.suppressionService.addSuppression(dto, user?.id);
  }

  @Delete(':id')
  async removeSuppression(@Param('id') id: string, @CurrentUser() user: any) {
    return this.suppressionService.removeSuppression(id, user?.id);
  }

  @Get('export')
  async exportSuppression(@Res() reply: FastifyReply) {
    const csvContent = await this.suppressionService.exportSuppressionCsv();

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="fixhubtech_suppression_list.csv"')
      .send(csvContent);
  }
}
