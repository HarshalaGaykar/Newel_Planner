import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ChangeRequestsService } from './change-requests.service';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { UpdateChangeRequestDto } from './dto/update-change-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Change Requests')
@ApiBearerAuth()
@Controller('change-requests')
@UseGuards(JwtAuthGuard)
export class ChangeRequestsController {
  constructor(private readonly changeRequestsService: ChangeRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new change request for a project' })
  create(@Body() createChangeRequestDto: CreateChangeRequestDto, @Request() req) {
    return this.changeRequestsService.create(createChangeRequestDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Get a list of change requests, optionally filtered by project' })
  findAll(@Query('projectId') projectId?: string) {
    return this.changeRequestsService.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single change request by ID' })
  findOne(@Param('id') id: string) {
    return this.changeRequestsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing change request by ID' })
  update(@Param('id') id: string, @Body() updateChangeRequestDto: UpdateChangeRequestDto, @Request() req) {
    return this.changeRequestsService.update(id, updateChangeRequestDto, req.user.userId);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit a change request for approval' })
  submit(@Param('id') id: string, @Request() req) {
    return this.changeRequestsService.submit(id, req.user.userId);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a change request' })
  addComment(@Param('id') id: string, @Body('body') body: string, @Request() req) {
    return this.changeRequestsService.addComment(id, req.user.userId, body);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close a change request' })
  close(@Param('id') id: string, @Request() req) {
    return this.changeRequestsService.close(id, req.user.userId);
  }
}
