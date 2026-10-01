import { Test, TestingModule } from '@nestjs/testing';
import { DemandsService } from './demands.service';

describe('DemandsService', () => {
  let service: DemandsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DemandsService],
    }).compile();

    service = module.get<DemandsService>(DemandsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
