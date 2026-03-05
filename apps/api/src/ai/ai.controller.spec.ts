import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiDealBriefService } from './ai-deal-brief.service';
import { AiService } from './ai.service';

describe('AiController', () => {
  let controller: AiController;
  let aiDealBriefService: AiDealBriefService;

  const mockDealBriefResponse = {
    opportunityId: 'opp-1',
    briefMarkdown: '## Deal Summary\nTest.',
    activityId: 'act-1',
    generatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    const mockAiDealBriefService = {
      generateDealBrief: jest.fn().mockResolvedValue(mockDealBriefResponse),
    };
    const mockAiService = {};

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        { provide: AiDealBriefService, useValue: mockAiDealBriefService },
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
    aiDealBriefService = module.get<AiDealBriefService>(AiDealBriefService);
    jest.clearAllMocks();
  });

  describe('POST /ai/deal-brief/:opportunityId', () => {
    it('ADMIN/USER: delegates to AiDealBriefService and returns result', async () => {
      const result = await controller.generateDealBrief(
        'opp-1',
        'user-1',
        undefined,
      );

      expect(aiDealBriefService.generateDealBrief).toHaveBeenCalledWith(
        'opp-1',
        'user-1',
        { forceRefresh: false, lookbackDays: 30 },
      );
      expect(result).toEqual(mockDealBriefResponse);
    });

    it('passes forceRefresh and lookbackDays from body to service', async () => {
      await controller.generateDealBrief('opp-2', 'user-2', {
        forceRefresh: true,
        lookbackDays: 14,
      });

      expect(aiDealBriefService.generateDealBrief).toHaveBeenCalledWith(
        'opp-2',
        'user-2',
        { forceRefresh: true, lookbackDays: 14 },
      );
    });
  });
});
