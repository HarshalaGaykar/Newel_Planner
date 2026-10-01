import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Roles, Permissions } from '../auth/decorators/rbac.decorator';
import { Role, Permission } from '../auth/constants/rbac.constants';
import { SkillsService } from './skills.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

@ApiTags('Skills')
@ApiBearerAuth()
@Controller({ path: 'skills', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class SkillsController {
  constructor(private skillsService: SkillsService) {}

  @Get()
  @Permissions(Permission.USER_READ, Permission.USER_MANAGE, Permission.TRAINING_READ, Permission.TRAINING_MANAGE)
  @ApiOperation({ summary: 'Get a list of all skills' })
  findAll() {
    return this.skillsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single skill by ID' })
  findOne(@Param('id') id: string) {
    return this.skillsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new skill' })
  create(@Body() dto: CreateSkillDto) {
    return this.skillsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing skill by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateSkillDto) {
    return this.skillsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a skill by ID' })
  remove(@Param('id') id: string) {
    return this.skillsService.remove(id);
  }
}
