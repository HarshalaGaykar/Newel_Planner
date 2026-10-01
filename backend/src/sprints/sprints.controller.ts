import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddTasksDto } from './dto/add-tasks.dto';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { SprintsService } from './sprints.service';

@Controller('sprints')
@UseGuards(JwtAuthGuard)
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Get('backlog')
  getBacklog(@Query('projectId') projectId: string) {
    return this.sprintsService.getBacklog(projectId);
  }

  @Post()
  create(@Body() dto: CreateSprintDto) {
    return this.sprintsService.create(dto);
  }

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.sprintsService.findAll(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sprintsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSprintDto) {
    return this.sprintsService.update(id, dto);
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.sprintsService.start(id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.sprintsService.complete(id);
  }

  @Post(':id/tasks')
  addTasks(@Param('id') id: string, @Body() dto: AddTasksDto) {
    return this.sprintsService.addTasks(id, dto);
  }

  @Delete(':id/tasks/:taskId')
  removeTask(@Param('id') id: string, @Param('taskId') taskId: string) {
    return this.sprintsService.removeTask(id, taskId);
  }

  @Get(':id/burndown')
  getBurndown(@Param('id') id: string) {
    return this.sprintsService.getBurndown(id);
  }
}
