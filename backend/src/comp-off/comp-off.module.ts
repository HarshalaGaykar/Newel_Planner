import { Module } from '@nestjs/common';
import { CompOffController } from './comp-off.controller';
import { CompOffService } from './comp-off.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [CompOffController],
  providers: [CompOffService],
  exports: [CompOffService],
})
export class CompOffModule {}
