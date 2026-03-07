import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { AiAdapter } from './adapter/ai-adapter.interface';
import { AiDealBriefService } from './ai-deal-brief.service';

const OPP_ID = 'opp-1';
const USER_ID = 'user-1';
const TENANT_ID = 'tenant-1';
const CACHED_ACTIVITY_ID = 'act-cached';
const NEW_ACTIVITY_ID = 'act-new';

describe('AiDealBriefService', () => {
  let service: AiDealBriefService;
  let prisma: { activity: { findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock }; opportunity: { findFirst: jest.Mock }; attachment: { findMany: jest.Mock } };
  let activityService: { createRaw: jest.Mock };
  let aiAdapter: { chat: jest.Mock };

  const mockOpportunity = {
    id: OPP_ID,
    name: 'Deal A',
    stage: 'proposal',
    amount: 100000,
    closeDate: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(),
    winProbability: 60,
    forecastCategory: 'pipeline',
    account: {
      name: 'Acme',
      industry: 'Tech',
      website: 'https://acme.com',
      contacts: [
        { firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com', phone: null },
      ],
    },
  };

  beforeEach(async () => {
    const mockPrisma = {
      activity: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      opportunity: {
        findFirst: jest.fn().mockResolvedValue(mockOpportunity),
      },
      attachment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const mockActivityService = {
      createRaw: jest.fn().mockResolvedValue({
        id: NEW_ACTIVITY_ID,
        entityType: 'opportunity',
        entityId: OPP_ID,
        type: 'ai_deal_brief',
        payload: {},
        createdAt: new Date(),
      }),
    };
    const mockAiAdapter = {
      chat: jest.fn().mockResolvedValue('## Deal Summary\nTest brief.\n\nAI Confidence: Medium'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiDealBriefService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ActivityService, useValue: mockActivityService },
        { provide: AiAdapter, useValue: mockAiAdapter },
      ],
    }).compile();

    service = module.get<AiDealBriefService>(AiDealBriefService);
    prisma = module.get(PrismaService) as typeof mockPrisma;
    activityService = module.get(ActivityService) as typeof mockActivityService;
    aiAdapter = module.get(AiAdapter) as typeof mockAiAdapter;
    jest.clearAllMocks();
  });

  describe('generateDealBrief', () => {
    it('returns cached brief when one exists within 6h and forceRefresh=false', async () => {
      const cachedCreatedAt = new Date();
      cachedCreatedAt.setHours(cachedCreatedAt.getHours() - 2);
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue({
        id: CACHED_ACTIVITY_ID,
        payload: {
          briefMarkdown: 'Cached brief content',
          generatedAt: cachedCreatedAt.toISOString(),
        },
        createdAt: cachedCreatedAt,
      });

      const result = await service.generateDealBrief(OPP_ID, USER_ID, TENANT_ID, {
        forceRefresh: false,
        lookbackDays: 30,
      });

      expect(result).toEqual({
        opportunityId: OPP_ID,
        briefMarkdown: 'Cached brief content',
        activityId: CACHED_ACTIVITY_ID,
        generatedAt: cachedCreatedAt.toISOString(),
      });
      expect(aiAdapter.chat).not.toHaveBeenCalled();
      expect(activityService.createRaw).not.toHaveBeenCalled();
    });

    it('does NOT return cache when activity is older than 6 hours', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(null);

      await service.generateDealBrief(OPP_ID, USER_ID, TENANT_ID, { forceRefresh: false });

      expect(aiAdapter.chat).toHaveBeenCalled();
      expect(activityService.createRaw).toHaveBeenCalled();
    });

    it('when forceRefresh=true generates new brief and creates activity', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(null);
      const mockMarkdown = '## Deal Summary\nNew brief.\n\nAI Confidence: High';
      (aiAdapter.chat as jest.Mock).mockResolvedValue(mockMarkdown);
      (activityService.createRaw as jest.Mock).mockResolvedValue({
        id: NEW_ACTIVITY_ID,
        entityType: 'opportunity',
        entityId: OPP_ID,
        type: 'ai_deal_brief',
        payload: {},
        createdAt: new Date(),
      });

      const result = await service.generateDealBrief(OPP_ID, USER_ID, TENANT_ID, {
        forceRefresh: true,
        lookbackDays: 14,
      });

      expect(aiAdapter.chat).toHaveBeenCalledWith(
        expect.arrayContaining([
          { role: 'system', content: expect.any(String) },
          { role: 'user', content: expect.any(String) },
        ]),
      );
      expect(activityService.createRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'opportunity',
          entityId: OPP_ID,
          type: 'ai_deal_brief',
          payload: expect.objectContaining({
            briefMarkdown: expect.stringContaining('Deal Summary'),
            createdBy: USER_ID,
            lookbackDays: 14,
            confidence: 'High',
          }),
        }),
      );
      expect(result.opportunityId).toBe(OPP_ID);
      expect(result.activityId).toBe(NEW_ACTIVITY_ID);
      expect(result.briefMarkdown).toContain('Deal Summary');
    });

    it('throws NotFoundException when opportunity does not exist', async () => {
      (prisma.opportunity.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.generateDealBrief(OPP_ID, USER_ID, TENANT_ID, { forceRefresh: true }),
      ).rejects.toThrow(NotFoundException);
      expect(aiAdapter.chat).not.toHaveBeenCalled();
    });
  });
});
