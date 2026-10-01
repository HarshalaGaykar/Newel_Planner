import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards, 
} from '@nestjs/common';
import { DemandsService } from './demands.service';
import { CreateDemandDto } from './dto/create-demand.dto';
import { UpdateDemandDto } from './dto/update-demand.dto';
import { ConvertDemandDto } from './dto/convert-demand.dto';
import { CreateDemandCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Demands')
@ApiBearerAuth()
@Controller('demands')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class DemandsController {
  constructor(private readonly demandsService: DemandsService) {}

  @Post()
  @Permissions(Permission.DEMAND_CREATE)
  @ApiOperation({ summary: 'Create a new demand' })
  create(@Body() createDemandDto: CreateDemandDto, @CurrentUser() user: any) {
    return this.demandsService.create(createDemandDto, user.userId);
  }

  @Get()
  @Permissions(Permission.DEMAND_VIEW)
  @ApiOperation({ summary: 'Get a list of demands visible to the current user' })
  findAll(@CurrentUser() user: any) {
    return this.demandsService.findAll(user.userId, user.role);
  }

  @Get(':id')
  @Permissions(Permission.DEMAND_VIEW)
  @ApiOperation({ summary: 'Get a single demand by ID' })
  findOne(@Param('id') id: string) {
    return this.demandsService.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.DEMAND_CREATE) // Requester can update their own draft
  @ApiOperation({ summary: 'Update an existing demand by ID' })
  update(
    @Param('id') id: string, 
    @Body() updateDemandDto: UpdateDemandDto, 
    @CurrentUser() user: any
  ) {
    return this.demandsService.update(id, updateDemandDto, user.userId);
  }

  @Delete(':id')
  @Permissions(Permission.DEMAND_CREATE)
  @ApiOperation({ summary: 'Delete a demand by ID' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.demandsService.remove(id, user.userId);
  }

  @Post(':id/submit')
  @Permissions(Permission.DEMAND_CREATE)
  @ApiOperation({ summary: 'Submit a demand for approval' })
  submit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.demandsService.submit(id, user.userId);
  }

  @Post(':id/convert')
  @Permissions(Permission.DEMAND_CONVERT)
  @ApiOperation({ summary: 'Convert a demand into a project' })
  convert(
    @Param('id') id: string, 
    @Body() convertDto: ConvertDemandDto, 
    @CurrentUser() user: any
  ) {
    return this.demandsService.convertToProject(id, user.userId, convertDto);
  }

  @Post(':id/comments')
  @Permissions(Permission.DEMAND_VIEW)
  @ApiOperation({ summary: 'Add a comment to a demand' })
  addComment(
    @Param('id') id: string, 
    @Body() commentDto: CreateDemandCommentDto, 
    @CurrentUser() user: any
  ) {
    return this.demandsService.addComment(id, user.userId, commentDto);
  }

  @Get(':id/comments')
  @Permissions(Permission.DEMAND_VIEW)
  @ApiOperation({ summary: 'Get all comments for a demand' })
  getComments(@Param('id') id: string) {
    return this.demandsService.getComments(id);
  }
}

