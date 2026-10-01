import { Module } from '@nestjs/common';
import { ProjectRecipientsController } from './project-recipients.controller';
import { ProjectRecipientsService } from './project-recipients.service';

@Module({
  controllers: [ProjectRecipientsController],
  providers: [ProjectRecipientsService],
  exports: [ProjectRecipientsService],
})
export class ProjectRecipientsModule {}
