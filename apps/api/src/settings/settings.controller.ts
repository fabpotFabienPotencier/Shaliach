import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UsePipes,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import {
  SenderProfileDto,
  SenderProfileSchema,
  UpdateSettingDto,
  UpdateSettingSchema,
} from './settings.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get('senders')
  async listSenderProfiles() {
    return this.settingsService.listSenderProfiles();
  }

  @Post('senders')
  async createSenderProfile(
    @Body(new ZodValidationPipe(SenderProfileSchema)) dto: SenderProfileDto,
    @CurrentUser() user: any,
  ) {
    return this.settingsService.createSenderProfile(dto, user?.id);
  }

  @Put('senders/:id')
  async updateSenderProfile(
    @Param('id') id: string,
    @Body() dto: Partial<SenderProfileDto>,
    @CurrentUser() user: any,
  ) {
    return this.settingsService.updateSenderProfile(id, dto, user?.id);
  }

  @Delete('senders/:id')
  async deleteSenderProfile(@Param('id') id: string, @CurrentUser() user: any) {
    return this.settingsService.deleteSenderProfile(id, user?.id);
  }

  @Get('system')
  async getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  @Post('system')
  async updateSetting(
    @Body(new ZodValidationPipe(UpdateSettingSchema)) dto: UpdateSettingDto,
    @CurrentUser() user: any,
  ) {
    return this.settingsService.updateSetting(dto, user?.id);
  }
}
