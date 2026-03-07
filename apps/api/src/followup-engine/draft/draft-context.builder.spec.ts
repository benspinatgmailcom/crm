import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DraftContextBuilder } from './draft-context.builder';

describe('DraftContextBuilder', () => {
  let builder: DraftContextBuilder;
  let prisma: PrismaService;

  const mockSuggestion = {
    id: 'sug-1',
    entityId: 'opp-1',
    metadata: {
      ruleCode: 'STALE_TOUCH_NO_NEXT_STEP',
      severity: 'warning',
      reasonCodes: ['STALE_TOUCH'],
      title: 'Follow up',
      description: 'No touch in a while.',
    },
  };

  const mockOpportunity = {
    id: 'opp-1',
    name: 'Test Opp',
    stage: 'proposal',
    amount: 100000,
    closeDate: new Date('2025-06-01'),
    lastActivityAt: new Date('2025-02-01'),
    lastStageChangedAt: new Date('2025-01-15'),
    nextFollowUpAt: null,
  };

  const mockActivities = [
    { id: 'act-1', type: 'note', payload: { text: 'Had a call' }, createdAt: new Date('2025-02-10') },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DraftContextBuilder,
        {
          provide: PrismaService,
          useValue: {
            activity: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
            opportunity: {
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    builder = module.get<DraftContextBuilder>(DraftContextBuilder);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('buildFromSuggestion', () => {
    it('returns brief with opportunity, trigger, recentActivitySummary, constraints', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(mockSuggestion);
      (prisma.opportunity.findFirst as jest.Mock).mockResolvedValue(mockOpportunity);
      (prisma.activity.findMany as jest.Mock).mockResolvedValue(mockActivities);

      const brief = await builder.buildFromSuggestion('sug-1', 'tenant-1');

      expect(brief.opportunity.id).toBe('opp-1');
      expect(brief.opportunity.name).toBe('Test Opp');
      expect(brief.trigger.ruleCode).toBe('STALE_TOUCH_NO_NEXT_STEP');
      expect(brief.trigger.title).toBe('Follow up');
      expect(brief.recentActivitySummary).toHaveLength(1);
      expect(brief.recentActivitySummary[0].type).toBe('note');
      expect(brief.constraints.groundingRules.length).toBeGreaterThan(0);
    });

    it('throws NotFoundException when suggestion not found', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(builder.buildFromSuggestion('missing', 'tenant-1')).rejects.toThrow(NotFoundException);
    });
  });
});
