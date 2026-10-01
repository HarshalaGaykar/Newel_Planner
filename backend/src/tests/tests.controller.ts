import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TestsService } from './tests.service';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { AddQuestionsDto } from './dto/add-questions.dto';
import { AssignTestDto } from './dto/assign-test.dto';

@Controller({ path: 'tests', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TestsController {
  constructor(private service: TestsService) {}

  @Get()
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permissions(Permission.TEST_MANAGE)
  create(@Body() dto: CreateTestDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Patch(':id')
  @Permissions(Permission.TEST_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateTestDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/publish')
  @Permissions(Permission.TEST_MANAGE)
  publish(@Param('id') id: string) {
    return this.service.publish(id);
  }

  @Patch(':id/close')
  @Permissions(Permission.TEST_MANAGE)
  close(@Param('id') id: string) {
    return this.service.close(id);
  }

  @Post(':id/questions')
  @Permissions(Permission.TEST_MANAGE)
  addQuestions(@Param('id') id: string, @Body() dto: AddQuestionsDto) {
    return this.service.addQuestions(id, dto);
  }

  @Post(':id/assign')
  @Permissions(Permission.TEST_MANAGE)
  assign(@Param('id') id: string, @Body() dto: AssignTestDto) {
    return this.service.assign(id, dto);
  }

  @Delete(':id/assign/:assignmentId')
  @Permissions(Permission.TEST_MANAGE)
  removeAssignment(@Param('id') id: string, @Param('assignmentId') assignmentId: string) {
    return this.service.removeAssignment(id, assignmentId);
  }

  @Get(':id/results')
  @Permissions(Permission.TEST_MANAGE)
  getResults(@Param('id') id: string) {
    return this.service.getResults(id);
  }

  @Delete(':id')
  @Permissions(Permission.TEST_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
