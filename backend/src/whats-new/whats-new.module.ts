import { Module } from '@nestjs/common';
import { WhatsNewService } from './whats-new.service';
import { WhatsNewController } from './whats-new.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WhatsNewController],
  providers: [WhatsNewService],
})
export class WhatsNewModule {}
