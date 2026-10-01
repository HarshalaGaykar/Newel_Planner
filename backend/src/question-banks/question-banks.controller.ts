import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { QuestionBanksService } from './question-banks.service';
import { CreateQuestionBankDto } from './dto/create-question-bank.dto';
import { UpdateQuestionBankDto } from './dto/update-question-bank.dto';

@Controller({ path: 'question-banks', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class QuestionBanksController {
  constructor(private service: QuestionBanksService) {}

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
  create(@Body() dto: CreateQuestionBankDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Patch(':id')
  @Permissions(Permission.TEST_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateQuestionBankDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permissions(Permission.TEST_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
