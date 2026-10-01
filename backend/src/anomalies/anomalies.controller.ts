import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnomaliesService } from './anomalies.service';

@ApiTags('Anomalies')
@ApiBearerAuth()
@Controller('anomalies')
export class AnomaliesController {
  constructor(private readonly anomaliesService: AnomaliesService) {}

  @Get()
  @ApiOperation({ summary: 'Get the list of detected anomaly alerts' })
  getAlerts() {
    return this.anomaliesService.getAlerts();
  }
}
