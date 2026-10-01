import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TestAttemptsService } from './test-attempts.service';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';

@Controller({ path: 'test-attempts', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TestAttemptsController {
  constructor(private service: TestAttemptsService) {}

  @Get('my-tests')
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  getMyTests(@CurrentUser('id') userId: string) {
    return this.service.getMyTests(userId);
  }

  @Post('start')
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  start(@Body() dto: StartAttemptDto, @CurrentUser('id') userId: string) {
    return this.service.start(dto, userId);
  }

  @Get(':id')
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  getAttempt(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.getAttempt(id, userId);
  }

  @Post(':id/answer')
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  saveAnswer(@Param('id') id: string, @Body() dto: SaveAnswerDto, @CurrentUser('id') userId: string) {
    return this.service.saveAnswer(id, dto, userId);
  }

  @Post(':id/submit')
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  submit(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.submit(id, userId);
  }

  @Get(':id/result')
  @Permissions(Permission.TEST_READ, Permission.TEST_MANAGE)
  getResult(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.getResult(id, userId);
  }
}
