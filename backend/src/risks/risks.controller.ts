import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards,
} from '@nestjs/common';
import { RisksService } from './risks.service';
import { CreateRiskDto } from './dto/create-risk.dto';
import { UpdateRiskDto } from './dto/update-risk.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('risks')
@UseGuards(JwtAuthGuard)
export class RisksController {
  constructor(private readonly risksService: RisksService) {}

  @Post()
  create(@Body() dto: CreateRiskDto) {
    return this.risksService.create(dto);
  }

  @Get()
  findAll(
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.risksService.findAll(projectId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.risksService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRiskDto) {
    return this.risksService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.risksService.remove(id);
  }
}
