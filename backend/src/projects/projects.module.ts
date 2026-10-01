import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectDormancyCron } from './project-dormancy.cron';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectDormancyCron],
  exports: [ProjectsService, ProjectDormancyCron],
})
export class ProjectsModule {}
