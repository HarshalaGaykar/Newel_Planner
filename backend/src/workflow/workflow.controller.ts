import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards, 
  Request 
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowTemplateDto } from './dto/create-template.dto';
import { TakeActionDto } from './dto/take-action.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/rbac.guard';
import { Roles } from '../auth/decorators/rbac.decorator';
import { Role } from '../auth/constants/rbac.constants';

@Controller('workflow')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post('templates')
  @Roles(Role.ADMIN)
  createTemplate(@Body() dto: CreateWorkflowTemplateDto) {
    return this.workflowService.createTemplate(dto);
  }

  @Get('templates')
  getAllTemplates() {
    return this.workflowService.getTemplateForModule('ALL'); // Simplified
  }

  @Get('templates/:module')
  getTemplateByModule(@Param('module') module: string) {
    return this.workflowService.getTemplateForModule(module);
  }

  @Post('instances/:id/action')
  takeAction(
    @Param('id') id: string,
    @Body() dto: TakeActionDto,
    @Request() req: any,
  ) {
    return this.workflowService.takeAction(id, req.user.userId, dto);
  }

  @Get('pending')
  getPending(@Request() req: any) {
    return this.workflowService.getPendingForActor(req.user.userId);
  }

  @Get('history/:entityType/:entityId')
  getHistory(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.workflowService.getInstanceHistory(entityType, entityId);
  }
}
