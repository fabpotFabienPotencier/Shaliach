import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CommonModule } from '../common/common.module';

@Global()
@Module({
  imports: [CommonModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
