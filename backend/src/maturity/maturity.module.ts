import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MaturityController } from './maturity.controller';
import { MaturityService } from './maturity.service';

@Module({
  imports: [PrismaModule],
  controllers: [MaturityController],
  providers: [MaturityService],
  exports: [MaturityService],
})
export class MaturityModule {}
