import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Controller({ path: 'questions', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class QuestionsController {
  constructor(private service: QuestionsService) {}

  @Get()
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  findByBank(@Query('bankId') bankId: string) {
    return this.service.findByBank(bankId);
  }

  @Get(':id')
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permissions(Permission.TEST_MANAGE)
  create(@Body() dto: CreateQuestionDto) {
    return this.service.create(dto);
  }
  
  @Post('bulk')
  @Permissions(Permission.TEST_MANAGE)
  bulkCreate(@Body() body: { bankId: string; questions: CreateQuestionDto[] }) {
    return this.service.createMany(body.bankId, body.questions);
  }

  @Patch(':id')
  @Permissions(Permission.TEST_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateQuestionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.TEST_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
