import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TestManagementService } from './test-management.service';
import { CreateSuiteDto } from './dto/create-suite.dto';
import { UpdateSuiteDto } from './dto/update-suite.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { CreateRunDto } from './dto/create-run.dto';
import { UpdateRunDto } from './dto/update-run.dto';
import { UpdateExecutionDto } from './dto/update-execution.dto';
import { AddCasesToRunDto } from './dto/add-cases-to-run.dto';
import { SuiteQueryDto, CaseQueryDto, RunQueryDto } from './dto/query.dto';

@Controller({ path: 'test-management', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TestManagementController {
  constructor(private service: TestManagementService) {}

  // ── SUITES ──────────────────────────────────────────────────────────────────

  @Get('suites')
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  findAllSuites(@Query() query: SuiteQueryDto) {
    return this.service.findAllSuites(query);
  }

  @Get('suites/:id')
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  findOneSuite(@Param('id') id: string) {
    return this.service.findOneSuite(id);
  }

  @Post('suites')
  @Permissions(Permission.TEST_MANAGE)
  createSuite(@Body() dto: CreateSuiteDto, @CurrentUser('userId') userId: string) {
    return this.service.createSuite(dto, userId);
  }

  @Patch('suites/:id')
  @Permissions(Permission.TEST_MANAGE)
  updateSuite(@Param('id') id: string, @Body() dto: UpdateSuiteDto) {
    return this.service.updateSuite(id, dto);
  }

  @Delete('suites/:id')
  @Permissions(Permission.TEST_MANAGE)
  removeSuite(@Param('id') id: string) {
    return this.service.removeSuite(id);
  }

  // ── CASES ────────────────────────────────────────────────────────────────────

  @Get('cases')
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  findAllCases(@Query() query: CaseQueryDto) {
    return this.service.findAllCases(query);
  }

  @Get('cases/:id')
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  findOneCase(@Param('id') id: string) {
    return this.service.findOneCase(id);
  }

  @Post('cases')
  @Permissions(Permission.TEST_MANAGE)
  createCase(@Body() dto: CreateCaseDto, @CurrentUser('userId') userId: string) {
    return this.service.createCase(dto, userId);
  }

  @Patch('cases/:id')
  @Permissions(Permission.TEST_MANAGE)
  updateCase(@Param('id') id: string, @Body() dto: UpdateCaseDto) {
    return this.service.updateCase(id, dto);
  }

  @Delete('cases/:id')
  @Permissions(Permission.TEST_MANAGE)
  removeCase(@Param('id') id: string) {
    return this.service.removeCase(id);
  }

  // ── RUNS ─────────────────────────────────────────────────────────────────────

  @Get('runs')
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  findAllRuns(@Query() query: RunQueryDto) {
    return this.service.findAllRuns(query);
  }

  @Get('runs/:id')
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  findOneRun(@Param('id') id: string) {
    return this.service.findOneRun(id);
  }

  @Get('runs/:id/summary')
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  getRunSummary(@Param('id') id: string) {
    return this.service.getRunSummary(id);
  }

  @Post('runs')
  @Permissions(Permission.TEST_MANAGE)
  createRun(@Body() dto: CreateRunDto, @CurrentUser('userId') userId: string) {
    return this.service.createRun(dto, userId);
  }

  @Post('runs/:id/cases')
  @Permissions(Permission.TEST_MANAGE)
  addCasesToRun(@Param('id') runId: string, @Body() dto: AddCasesToRunDto) {
    return this.service.addCasesToRun(runId, dto);
  }

  @Patch('runs/:id')
  @Permissions(Permission.TEST_MANAGE)
  updateRun(@Param('id') id: string, @Body() dto: UpdateRunDto) {
    return this.service.updateRun(id, dto);
  }

  @Delete('runs/:id')
  @Permissions(Permission.TEST_MANAGE)
  removeRun(@Param('id') id: string) {
    return this.service.removeRun(id);
  }

  // ── EXECUTIONS ───────────────────────────────────────────────────────────────

  @Patch('executions/:id')
  @Permissions(Permission.TEST_MANAGE, Permission.TEST_EXECUTE)
  updateExecution(
    @Param('id') id: string,
    @Body() dto: UpdateExecutionDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.updateExecution(id, dto, userId);
  }

  @Post('executions/:id/bug')
  @Permissions(Permission.TEST_MANAGE, Permission.TEST_EXECUTE)
  createBug(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.service.createBugFromExecution(id, userId);
  }
}
