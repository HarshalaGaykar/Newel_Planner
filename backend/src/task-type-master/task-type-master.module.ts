import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../prisma/prisma.module';
import { TaskTypeMasterController } from './task-type-master.controller';
import { TaskTypeMasterService } from './task-type-master.service';

@Module({
  imports: [PrismaModule, MulterModule.register()],
  controllers: [TaskTypeMasterController],
  providers: [TaskTypeMasterService],
  exports: [TaskTypeMasterService],
})
export class TaskTypeMasterModule {}
