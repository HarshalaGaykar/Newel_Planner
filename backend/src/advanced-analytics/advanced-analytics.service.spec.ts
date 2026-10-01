import { Test, TestingModule } from '@nestjs/testing';
import { AdvancedAnalyticsService } from './advanced-analytics.service';

describe('AdvancedAnalyticsService', () => {
  let service: AdvancedAnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdvancedAnalyticsService],
    }).compile();

    service = module.get<AdvancedAnalyticsService>(AdvancedAnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
