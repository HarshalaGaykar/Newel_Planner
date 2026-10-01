import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { SpokespersonsService } from './spokespersons.service';
import { CreateSpokespersonDto } from './dto/create-spokesperson.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Spokespersons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('spokespersons')
export class SpokespersonsController {
  constructor(private readonly spokespersonsService: SpokespersonsService) {}

  @Get()
  @ApiOperation({ summary: 'List active spokespersons for a client' })
  findByClient(@Query('clientId') clientId: string) {
    return this.spokespersonsService.findByClient(clientId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a spokesperson for a client (dedupes/reactivates by name)' })
  create(@Body() dto: CreateSpokespersonDto, @Request() req: any) {
    return this.spokespersonsService.create(dto, req.user.userId);
  }
}
