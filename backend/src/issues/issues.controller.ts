import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards,
} from '@nestjs/common';
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Issues')
@ApiBearerAuth()
@Controller('issues')
@UseGuards(JwtAuthGuard)
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new issue for a project' })
  create(@Body() dto: CreateIssueDto, @CurrentUser() user: any) {
    return this.issuesService.create(dto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get a list of issues filtered by project and status' })
  findAll(
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.issuesService.findAll(projectId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single issue by ID' })
  findOne(@Param('id') id: string) {
    return this.issuesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing issue by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateIssueDto) {
    return this.issuesService.update(id, dto);
  }

  @Post(':id/escalate')
  @ApiOperation({ summary: 'Escalate an issue by ID' })
  escalate(@Param('id') id: string) {
    return this.issuesService.escalate(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an issue by ID' })
  remove(@Param('id') id: string) {
    return this.issuesService.remove(id);
  }
}
