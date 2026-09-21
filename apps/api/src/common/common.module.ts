import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [PrismaService, RedisService, StorageService],
  exports: [PrismaService, RedisService, StorageService],
})
export class CommonModule {}
