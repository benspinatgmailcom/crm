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
      const user = { id: 'user-1', tenantId: 'tenant-1', email: 'u@test.com', role: 'USER' } as any;
      const result = await controller.generateDealBrief(
        'opp-1',
        user,
        undefined,
      );

      expect(aiDealBriefService.generateDealBrief).toHaveBeenCalledWith(
        'opp-1',
        'user-1',
        'tenant-1',
        { forceRefresh: false, lookbackDays: 30 },
      );
      expect(result).toEqual(mockDealBriefResponse);
    });

    it('passes forceRefresh and lookbackDays from body to service', async () => {
      const user = { id: 'user-2', tenantId: 'tenant-1', email: 'u2@test.com', role: 'USER' } as any;
      await controller.generateDealBrief('opp-2', user, {
        forceRefresh: true,
        lookbackDays: 14,
      });

      expect(aiDealBriefService.generateDealBrief).toHaveBeenCalledWith(
        'opp-2',
        'user-2',
        'tenant-1',
        { forceRefresh: true, lookbackDays: 14 },
      );
    });
  });
});
