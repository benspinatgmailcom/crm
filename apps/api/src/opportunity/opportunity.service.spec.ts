import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Opportunity } from '@crm/db';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { OpportunityService } from './opportunity.service';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

describe('OpportunityService', () => {
  let service: OpportunityService;
  let prisma: PrismaService;
  let activityService: ActivityService;

  const existingOpp = {
    id: 'opp-1',
    accountId: 'acc-1',
    name: 'Deal',
    amount: 10000,
    stage: 'prospecting',
    probability: 25,
    closeDate: null,
    sourceLeadId: null,
    lastActivityAt: null,
    lastStageChangedAt: null,
    nextFollowUpAt: null,
    healthScore: null,
    healthSignals: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Opportunity;

  const mockPrisma = {
    opportunity: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockActivityService = {
    createRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.opportunity.findUnique.mockResolvedValue(existingOpp);
    mockPrisma.opportunity.update.mockImplementation((args: { where: { id: string }; data: object }) =>
      Promise.resolve({ ...existingOpp, ...args.data, updatedAt: new Date() }),
    );
    mockActivityService.createRaw.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpportunityService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ActivityService, useValue: mockActivityService },
      ],
    }).compile();

    service = module.get<OpportunityService>(OpportunityService);
    prisma = module.get<PrismaService>(PrismaService);
    activityService = module.get<ActivityService>(ActivityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('sets lastStageChangedAt and creates stage_change activity when stage changes', async () => {
      const dto: UpdateOpportunityDto = { stage: 'qualification' };

      const result = await service.update('opp-1', dto);

      expect(prisma.opportunity.update).toHaveBeenCalledWith({
        where: { id: 'opp-1' },
        data: expect.objectContaining({
          stage: 'qualification',
          lastStageChangedAt: expect.any(Date),
        }),
      });
      expect(activityService.createRaw).toHaveBeenCalledTimes(1);
      expect(activityService.createRaw).toHaveBeenCalledWith({
        entityType: 'opportunity',
        entityId: 'opp-1',
        type: 'stage_change',
        payload: { from: 'prospecting', to: 'qualification' },
      });
      expect(result.lastStageChangedAt).toBeDefined();
    });

    it('does not set lastStageChangedAt or create activity when stage is unchanged', async () => {
      const dto: UpdateOpportunityDto = { name: 'New name' };

      await service.update('opp-1', dto);

      expect(prisma.opportunity.update).toHaveBeenCalledWith({
        where: { id: 'opp-1' },
        data: expect.not.objectContaining({
          lastStageChangedAt: expect.anything(),
        }),
      });
      expect(activityService.createRaw).not.toHaveBeenCalled();
    });

    it('does not set lastStageChangedAt when stage is same as current (idempotency)', async () => {
      mockPrisma.opportunity.findUnique.mockResolvedValue({
        ...existingOpp,
        stage: 'qualification',
      });
      const dto: UpdateOpportunityDto = { stage: 'qualification' };

      await service.update('opp-1', dto);

      const updateCall = (prisma.opportunity.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('lastStageChangedAt');
      expect(activityService.createRaw).not.toHaveBeenCalled();
    });

    it('throws when opportunity not found', async () => {
      mockPrisma.opportunity.findUnique.mockResolvedValue(null);

      await expect(service.update('opp-missing', { stage: 'qualification' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.opportunity.update).not.toHaveBeenCalled();
      expect(activityService.createRaw).not.toHaveBeenCalled();
    });
  });

  describe('getPipeline', () => {
    const refTime = new Date('2025-02-15T12:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(refTime);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns daysSinceLastTouch and daysInStage from timestamps (correct calculations)', async () => {
      const lastActivityAt = new Date('2025-02-12T12:00:00.000Z'); // 3 days ago
      const lastStageChangedAt = new Date('2025-02-10T12:00:00.000Z'); // 5 days ago
      mockPrisma.opportunity.findMany.mockResolvedValue([
        {
          id: 'opp-a',
          name: 'Deal A',
          amount: 5000,
          closeDate: null,
          stage: 'prospecting',
          accountId: 'acc-1',
          lastActivityAt,
          lastStageChangedAt,
          nextFollowUpAt: new Date('2025-02-20'),
          account: { name: 'Acme' },
        },
      ]);

      const result = await service.getPipeline();

      expect(result.prospecting).toHaveLength(1);
      expect(result.prospecting[0].daysSinceLastTouch).toBe(3);
      expect(result.prospecting[0].daysInStage).toBe(5);
    });

    it('returns null for daysSinceLastTouch and daysInStage when timestamps are null', async () => {
      mockPrisma.opportunity.findMany.mockResolvedValue([
        {
          id: 'opp-b',
          name: 'Deal B',
          amount: null,
          closeDate: null,
          stage: 'qualification',
          accountId: 'acc-1',
          lastActivityAt: null,
          lastStageChangedAt: null,
          nextFollowUpAt: null,
          account: { name: 'Acme' },
        },
      ]);

      const result = await service.getPipeline();

      expect(result.qualification).toHaveLength(1);
      expect(result.qualification[0].daysSinceLastTouch).toBeNull();
      expect(result.qualification[0].daysInStage).toBeNull();
    });

    it('returns null for one derived field when only the other timestamp is set', async () => {
      const lastActivityAt = new Date('2025-02-14T12:00:00.000Z'); // 1 day ago
      mockPrisma.opportunity.findMany.mockResolvedValue([
        {
          id: 'opp-c',
          name: 'Deal C',
          amount: null,
          closeDate: null,
          stage: 'discovery',
          accountId: 'acc-1',
          lastActivityAt,
          lastStageChangedAt: null,
          nextFollowUpAt: null,
          account: { name: 'Acme' },
        },
      ]);

      const result = await service.getPipeline();

      expect(result.discovery).toHaveLength(1);
      expect(result.discovery[0].daysSinceLastTouch).toBe(1);
      expect(result.discovery[0].daysInStage).toBeNull();
    });

    it('preserves existing fields (backward compatible)', async () => {
      mockPrisma.opportunity.findMany.mockResolvedValue([
        {
          id: 'opp-d',
          name: 'Deal D',
          amount: 10000,
          closeDate: new Date('2025-03-01'),
          stage: 'negotiation',
          accountId: 'acc-2',
          lastActivityAt: null,
          lastStageChangedAt: null,
          nextFollowUpAt: null,
          account: { name: 'Beta' },
        },
      ]);

      const result = await service.getPipeline();

      expect(result.negotiation).toHaveLength(1);
      const entry = result.negotiation[0];
      expect(entry.id).toBe('opp-d');
      expect(entry.name).toBe('Deal D');
      expect(entry.amount).toBe(10000);
      expect(entry.closeDate).toEqual(new Date('2025-03-01'));
      expect(entry.stage).toBe('negotiation');
      expect(entry.accountId).toBe('acc-2');
      expect(entry.accountName).toBe('Beta');
      expect(entry).toHaveProperty('daysSinceLastTouch');
      expect(entry).toHaveProperty('daysInStage');
      expect(entry).toHaveProperty('healthScore');
      expect(entry).toHaveProperty('healthStatus');
      expect(entry).toHaveProperty('healthSignals');
      expect(Array.isArray(entry.healthSignals)).toBe(true);
    });

    it('uses single findMany (no per-opportunity queries)', async () => {
      mockPrisma.opportunity.findMany.mockResolvedValue([]);

      await service.getPipeline();

      expect(prisma.opportunity.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.opportunity.findMany).toHaveBeenCalledWith({
        select: expect.objectContaining({
          id: true,
          name: true,
          amount: true,
          closeDate: true,
          stage: true,
          accountId: true,
          lastActivityAt: true,
          lastStageChangedAt: true,
          nextFollowUpAt: true,
          account: { select: { name: true } },
        }),
      });
    });
  });
});
