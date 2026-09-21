import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SenderProfileDto, UpdateSettingDto } from './settings.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async listSenderProfiles() {
    return this.prisma.senderProfile.findMany({
      orderBy: { isDefault: 'desc' },
    });
  }

  async createSenderProfile(dto: SenderProfileDto, userId?: string) {
    if (dto.isDefault) {
      await this.prisma.senderProfile.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const profile = await this.prisma.senderProfile.create({
      data: dto,
    });

    await this.audit.log({
      userId,
      action: 'CREATE_SENDER_PROFILE',
      entityType: 'SenderProfile',
      entityId: profile.id,
      details: dto,
    });

    return profile;
  }

  async updateSenderProfile(id: string, dto: Partial<SenderProfileDto>, userId?: string) {
    if (dto.isDefault) {
      await this.prisma.senderProfile.updateMany({
        where: { isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.senderProfile.update({
      where: { id },
      data: dto,
    });

    await this.audit.log({
      userId,
      action: 'UPDATE_SENDER_PROFILE',
      entityType: 'SenderProfile',
      entityId: id,
      details: dto,
    });

    return updated;
  }

  async deleteSenderProfile(id: string, userId?: string) {
    await this.prisma.senderProfile.delete({
      where: { id },
    });

    await this.audit.log({
      userId,
      action: 'DELETE_SENDER_PROFILE',
      entityType: 'SenderProfile',
      entityId: id,
    });

    return { success: true };
  }

  async getAllSettings() {
    const settings = await this.prisma.setting.findMany();
    return settings.reduce((acc: any, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});
  }

  async updateSetting(dto: UpdateSettingDto, userId?: string) {
    const setting = await this.prisma.setting.upsert({
      where: { key: dto.key },
      create: { key: dto.key, value: dto.value },
      update: { value: dto.value },
    });

    await this.audit.log({
      userId,
      action: 'UPDATE_SYSTEM_SETTING',
      entityType: 'Setting',
      entityId: setting.id,
      details: { key: dto.key, value: dto.value },
    });

    return setting;
  }
}
