import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PipelineHealthService } from './pipeline-health.service';
import type { PipelineHealthQueryDto } from './dto/pipeline-health-query.dto';

const currentUser = {
  id: 'user-1',
  email: 'user@test.com',
  role: 'USER',
  passwordHash: 'x',
  isActive: true,
  mustChangePassword: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const adminUser = { ...currentUser, id: 'admin-1', role: 'ADMIN' };

describe('PipelineHealthService', () => {
  let service: PipelineHealthService;

  const mockOpportunities = [
    {
      id: 'opp-1',
      name: 'Deal A',
      stage: 'prospecting',
      amount: 100000,
      ownerId: 'user-1',
      lastActivityAt: new Date(Date.now() - 10 * 86400000),
      lastStageChangedAt: new Date(Date.now() - 5 * 86400000),
      nextFollowUpAt: new Date(Date.now() - 1 * 86400000),
      owner: { id: 'user-1', email: 'user@test.com' },
    },
    {
      id: 'opp-2',
      name: 'Deal B',
      stage: 'qualification',
      amount: 50000,
      ownerId: 'user-1',
      lastActivityAt: new Date(),
      lastStageChangedAt: new Date(),
      nextFollowUpAt: null,
      owner: { id: 'user-1', email: 'user@test.com' },
    },
  ];

  const mockPrisma = {
    opportunity: {
      findMany: jest.fn().mockResolvedValue(mockOpportunities),
    },
    activity: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineHealthService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<PipelineHealthService>(PipelineHealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('RBAC', () => {
    it('enforces owner=me for non-admin when owner=all is passed', async () => {
      const query: PipelineHealthQueryDto = { owner: 'all' };
      const result = await service.getPipelineHealth(currentUser as any, query);
      expect(result.filtersEcho.owner).toBe('me');
      expect(mockPrisma.opportunity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ownerId: 'user-1' }),
        }),
      );
    });

    it('allows owner=all for admin', async () => {
      const query: PipelineHealthQueryDto = { owner: 'all' };
      const result = await service.getPipelineHealth(adminUser as any, query);
      expect(result.filtersEcho.owner).toBe('all');
      expect(mockPrisma.opportunity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ ownerId: expect.anything() }),
        }),
      );
    });

    it('throws when non-admin requests another userId', async () => {
      const query: PipelineHealthQueryDto = { owner: 'other-user-id' };
      await expect(
        service.getPipelineHealth(currentUser as any, query),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('response shape', () => {
    it('returns filtersEcho, summary, topDrivers, byStage, queue', async () => {
      const result = await service.getPipelineHealth(currentUser as any, {});
      expect(result).toHaveProperty('filtersEcho');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('topDrivers');
      expect(result).toHaveProperty('byStage');
      expect(result).toHaveProperty('queue');
      expect(result.summary).toMatchObject({
        totalDeals: expect.any(Number),
        totalAmount: expect.any(Number),
        healthyCount: expect.any(Number),
        warningCount: expect.any(Number),
        criticalCount: expect.any(Number),
        atRiskAmount: expect.any(Number),
        overdueNextStepsCount: expect.any(Number),
        staleTouchCount: expect.any(Number),
      });
      expect(Array.isArray(result.topDrivers)).toBe(true);
      expect(Array.isArray(result.byStage)).toBe(true);
      expect(result.queue).toMatchObject({
        total: expect.any(Number),
        page: expect.any(Number),
        pageSize: expect.any(Number),
        items: expect.any(Array),
      });
    });

    it('applies pagination', async () => {
      const result = await service.getPipelineHealth(currentUser as any, {
        page: 2,
        pageSize: 1,
      });
      expect(result.queue.page).toBe(2);
      expect(result.queue.pageSize).toBe(1);
      expect(result.queue.items.length).toBeLessThanOrEqual(1);
    });

    it('queue items have followup flags', async () => {
      const result = await service.getPipelineHealth(currentUser as any, {});
      for (const item of result.queue.items) {
        expect(item.followup).toEqual({
          hasSuggestion: expect.any(Boolean),
          hasOpenTask: expect.any(Boolean),
          hasDraft: expect.any(Boolean),
        });
      }
    });
  });
});
