import { Module } from '@nestjs/common';
import { SpokespersonsService } from './spokespersons.service';
import { SpokespersonsController } from './spokespersons.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SpokespersonsController],
  providers: [SpokespersonsService],
  exports: [SpokespersonsService],
})
export class SpokespersonsModule {}
