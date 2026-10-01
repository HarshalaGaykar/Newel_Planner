import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FreelancersService } from './freelancers.service';
import { CreateFreelancerDto } from './dto/create-freelancer.dto';
import { UpdateFreelancerDto } from './dto/update-freelancer.dto';

@ApiTags('Freelancers')
@ApiBearerAuth()
@Controller('freelancers')
export class FreelancersController {
  constructor(private readonly freelancersService: FreelancersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new freelancer' })
  create(@Body() dto: CreateFreelancerDto) {
    return this.freelancersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get a list of freelancers with optional vendor, status, and skill filters' })
  findAll(
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: string,
    @Query('skillId') skillId?: string,
  ) {
    return this.freelancersService.findAll(vendorId, status, skillId);
  }

  @Get('expiring')
  @ApiOperation({ summary: 'Get freelancers whose contracts are expiring soon' })
  findExpiring() {
    return this.freelancersService.findExpiring();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single freelancer by ID' })
  findOne(@Param('id') id: string) {
    return this.freelancersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing freelancer by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateFreelancerDto) {
    return this.freelancersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a freelancer by ID' })
  remove(@Param('id') id: string) {
    return this.freelancersService.remove(id);
  }

  @Post(':id/skills')
  @ApiOperation({ summary: 'Assign skills with optional proficiency levels to a freelancer' })
  assignSkills(
    @Param('id') id: string,
    @Body() body: { skills: { skillId: string; level?: number }[] },
  ) {
    return this.freelancersService.assignSkills(id, body.skills);
  }
}
