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
import { TrainingService } from './training.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { EnrollDto } from './dto/enroll.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { ProgramQueryDto, SessionQueryDto } from './dto/query.dto';

@Controller({ path: 'training', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TrainingController {
  constructor(private trainingService: TrainingService) {}

  // ── CATEGORIES ──────────────────────────────────────────────────────────────

  @Get('categories')
  @Permissions(Permission.TRAINING_READ, Permission.TRAINING_MANAGE)
  findAllCategories() {
    return this.trainingService.findAllCategories();
  }

  @Get('categories/:id')
  @Permissions(Permission.TRAINING_READ, Permission.TRAINING_MANAGE)
  findOneCategory(@Param('id') id: string) {
    return this.trainingService.findOneCategory(id);
  }

  @Post('categories')
  @Permissions(Permission.TRAINING_MANAGE)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.trainingService.createCategory(dto);
  }

  @Patch('categories/:id')
  @Permissions(Permission.TRAINING_MANAGE)
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.trainingService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @Permissions(Permission.TRAINING_MANAGE)
  removeCategory(@Param('id') id: string) {
    return this.trainingService.removeCategory(id);
  }

  // ── PROGRAMS ─────────────────────────────────────────────────────────────────

  @Get('programs')
  @Permissions(Permission.TRAINING_READ, Permission.TRAINING_MANAGE)
  findAllPrograms(@Query() query: ProgramQueryDto) {
    return this.trainingService.findAllPrograms(query);
  }

  @Get('programs/:id')
  @Permissions(Permission.TRAINING_READ, Permission.TRAINING_MANAGE)
  findOneProgram(@Param('id') id: string) {
    return this.trainingService.findOneProgram(id);
  }

  @Post('programs')
  @Permissions(Permission.TRAINING_MANAGE)
  createProgram(@Body() dto: CreateProgramDto) {
    return this.trainingService.createProgram(dto);
  }

  @Patch('programs/:id')
  @Permissions(Permission.TRAINING_MANAGE)
  updateProgram(@Param('id') id: string, @Body() dto: UpdateProgramDto) {
    return this.trainingService.updateProgram(id, dto);
  }

  @Delete('programs/:id')
  @Permissions(Permission.TRAINING_MANAGE)
  removeProgram(@Param('id') id: string) {
    return this.trainingService.removeProgram(id);
  }

  // ── SESSIONS ─────────────────────────────────────────────────────────────────

  @Get('sessions')
  @Permissions(Permission.TRAINING_READ, Permission.TRAINING_MANAGE)
  findAllSessions(@Query() query: SessionQueryDto) {
    return this.trainingService.findAllSessions(query);
  }

  @Get('sessions/:id')
  @Permissions(Permission.TRAINING_READ, Permission.TRAINING_MANAGE)
  findOneSession(@Param('id') id: string) {
    return this.trainingService.findOneSession(id);
  }

  @Post('sessions')
  @Permissions(Permission.TRAINING_MANAGE)
  createSession(@Body() dto: CreateSessionDto) {
    return this.trainingService.createSession(dto);
  }

  @Patch('sessions/:id')
  @Permissions(Permission.TRAINING_MANAGE)
  updateSession(@Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.trainingService.updateSession(id, dto);
  }

  @Delete('sessions/:id')
  @Permissions(Permission.TRAINING_MANAGE)
  removeSession(@Param('id') id: string) {
    return this.trainingService.removeSession(id);
  }

  @Get('sessions/:id/feedback')
  @Permissions(Permission.TRAINING_MANAGE)
  getSessionFeedback(@Param('id') sessionId: string) {
    return this.trainingService.getSessionFeedback(sessionId);
  }

  // ── ENROLLMENTS ──────────────────────────────────────────────────────────────

  @Post('sessions/:id/enroll')
  @Permissions(Permission.TRAINING_MANAGE, Permission.TRAINING_ENROLL)
  enroll(
    @Param('id') sessionId: string,
    @Body() dto: EnrollDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.trainingService.enroll(sessionId, dto, userId, role);
  }

  @Get('sessions/:id/enrollments')
  @Permissions(Permission.TRAINING_READ, Permission.TRAINING_MANAGE)
  findSessionEnrollments(@Param('id') sessionId: string) {
    return this.trainingService.findSessionEnrollments(sessionId);
  }

  @Patch('enrollments/:id')
  @Permissions(Permission.TRAINING_MANAGE, Permission.TRAINING_ENROLL)
  updateEnrollment(
    @Param('id') enrollmentId: string,
    @Body() dto: UpdateEnrollmentDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.trainingService.updateEnrollment(enrollmentId, dto, userId, role);
  }

  @Delete('enrollments/:id')
  @Permissions(Permission.TRAINING_MANAGE)
  removeEnrollment(@Param('id') enrollmentId: string) {
    return this.trainingService.removeEnrollment(enrollmentId);
  }

  @Post('enrollments/:id/feedback')
  @Permissions(Permission.TRAINING_READ, Permission.TRAINING_ENROLL, Permission.TRAINING_MANAGE)
  submitFeedback(
    @Param('id') enrollmentId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.trainingService.submitFeedback(enrollmentId, userId, dto);
  }

  @Get('enrollments/:id/feedback')
  @Permissions(Permission.TRAINING_READ, Permission.TRAINING_MANAGE)
  getEnrollmentFeedback(@Param('id') enrollmentId: string) {
    return this.trainingService.getEnrollmentFeedback(enrollmentId);
  }

  // ── MY TRAINING ──────────────────────────────────────────────────────────────

  @Get('my')
  @Permissions(Permission.TRAINING_READ, Permission.TRAINING_ENROLL, Permission.TRAINING_MANAGE)
  findMyEnrollments(@CurrentUser('userId') userId: string) {
    return this.trainingService.findMyEnrollments(userId);
  }

  @Get('my/certificates')
  @Permissions(Permission.TRAINING_READ, Permission.TRAINING_ENROLL, Permission.TRAINING_MANAGE)
  getMyCertificates(@CurrentUser('userId') userId: string) {
    return this.trainingService.getMyCertificates(userId);
  }
}
