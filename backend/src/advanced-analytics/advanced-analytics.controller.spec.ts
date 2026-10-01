import { Test, TestingModule } from '@nestjs/testing';
import { AdvancedAnalyticsController } from './advanced-analytics.controller';

describe('AdvancedAnalyticsController', () => {
  let controller: AdvancedAnalyticsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdvancedAnalyticsController],
    }).compile();

    controller = module.get<AdvancedAnalyticsController>(AdvancedAnalyticsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
