import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MaturityService } from './maturity.service';
import { CreateMaturityDto } from './dto/create-maturity.dto';
import { UpdateMaturityDto } from './dto/update-maturity.dto';
import { QueryMaturityDto } from './dto/query-maturity.dto';
import { MaturityReportQueryDto } from './dto/maturity-report-query.dto';

const BULK_UPLOAD_ALLOWED_MIMETYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
];

@ApiTags('Maturity')
@ApiBearerAuth()
@Controller('maturity')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class MaturityController {
  constructor(private readonly maturityService: MaturityService) {}

  @Post()
  @Permissions(Permission.MATURITY_MANAGE)
  @ApiOperation({ summary: 'Create a new maturity record for an employee' })
  create(@Body() dto: CreateMaturityDto, @CurrentUser('userId') userId: string) {
    return this.maturityService.create(dto, userId);
  }

  @Patch(':userId')
  @Permissions(Permission.MATURITY_MANAGE)
  @ApiOperation({ summary: "Update an employee's maturity record for a given month" })
  update(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMaturityDto,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.maturityService.update(userId, dto, actorId);
  }

  @Get('report')
  @Permissions(Permission.MATURITY_VIEW)
  @ApiOperation({ summary: 'Get the employee maturity report with optional filters' })
  getReport(@Query() query: MaturityReportQueryDto) {
    return this.maturityService.getReport(query);
  }

  @Get('bulk-upload/template')
  @Permissions(Permission.MATURITY_MANAGE)
  @ApiOperation({ summary: 'Download the Excel template for bulk maturity upload' })
  async downloadTemplate(@Res() res: any) {
    const buffer = await this.maturityService.buildTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="employee-maturity-template.xlsx"');
    res.send(buffer);
  }

  @Post('bulk-upload')
  @Permissions(Permission.MATURITY_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        if (BULK_UPLOAD_ALLOWED_MIMETYPES.includes(file.mimetype) || file.originalname.match(/\.(xlsx|csv)$/i)) {
          cb(null, true);
        } else {
          cb(new Error('Only .xlsx and .csv files are accepted'), false);
        }
      },
    }),
  )
  @ApiOperation({ summary: 'Bulk upload employee maturity records from an Excel or CSV file' })
  bulkUpload(@UploadedFile() file: Express.Multer.File, @CurrentUser('userId') actorId: string) {
    if (!file) throw new BadRequestException('No file uploaded.');
    return this.maturityService.bulkUpload(file, actorId);
  }

  @Get(':userId/history')
  @Permissions(Permission.MATURITY_VIEW)
  @ApiOperation({ summary: 'Get the maturity history for a specific employee' })
  getHistory(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.maturityService.getHistory(userId);
  }

  @Get(':userId')
  @Permissions(Permission.MATURITY_VIEW)
  @ApiOperation({ summary: 'Get the current maturity record for a specific employee' })
  findOne(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.maturityService.findOne(userId);
  }

  @Get()
  @Permissions(Permission.MATURITY_VIEW)
  @ApiOperation({ summary: 'Get a list of employee maturity records with optional filters' })
  findAll(@Query() query: QueryMaturityDto) {
    return this.maturityService.findAll(query);
  }
}
