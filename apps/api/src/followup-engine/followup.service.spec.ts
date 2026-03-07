import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FollowUpService } from './followup.service';

describe('FollowUpService', () => {
  let service: FollowUpService;
  let prisma: { activity: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock }; opportunity: { findMany: jest.Mock } };

  beforeEach(async () => {
    const mockActivity = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    };
    const mockOpportunity = { findMany: jest.fn() };
    prisma = { activity: mockActivity, opportunity: mockOpportunity } as unknown as typeof prisma;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowUpService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<FollowUpService>(FollowUpService);
  });

  describe('listOpportunityFollowups', () => {
    it('returns suggestions and open tasks, excluding suggestions superseded by open task', async () => {
      prisma.activity.findMany.mockResolvedValue([
        {
          id: 's1',
          type: 'followup_suggested',
          metadata: {
            status: 'SUGGESTED',
            dedupeKey: 'opp1:STALE_TOUCH_NO_NEXT_STEP',
            title: 'Follow up',
            suggestedDueAt: '2025-02-15T09:00:00.000Z',
            severity: 'warning',
            reasonCodes: ['STALE_TOUCH'],
          },
          createdAt: new Date(),
        },
        {
          id: 't1',
          type: 'task_created',
          metadata: { status: 'OPEN', dedupeKey: 'opp1:OVERDUE_NEXT_STEP', title: 'Overdue', dueAt: '2025-02-14T17:00:00.000Z' },
          createdAt: new Date(),
        },
        {
          id: 's2',
          type: 'followup_suggested',
          metadata: {
            status: 'SUGGESTED',
            dedupeKey: 'opp1:OVERDUE_NEXT_STEP',
            title: 'Overdue suggestion',
          },
          createdAt: new Date(),
        },
      ]);

      const result = await service.listOpportunityFollowups('opp1', 'tenant-1');

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].id).toBe('s1');
      expect(result.suggestions[0].metadata.dedupeKey).toBe('opp1:STALE_TOUCH_NO_NEXT_STEP');
      expect(result.openTasks).toHaveLength(1);
      expect(result.openTasks[0].id).toBe('t1');
    });

    it('excludes task from openTasks when task_completed exists', async () => {
      prisma.activity.findMany.mockResolvedValue([
        { id: 't1', type: 'task_created', metadata: { status: 'OPEN' }, createdAt: new Date() },
        { id: 'e1', type: 'task_completed', metadata: { taskActivityId: 't1', status: 'COMPLETED' }, createdAt: new Date() },
      ]);

      const result = await service.listOpportunityFollowups('opp1', 'tenant-1');
      expect(result.openTasks).toHaveLength(0);
    });
  });

  describe('createTaskFromSuggestion', () => {
    it('creates task_created with createdFromSuggestionActivityId', async () => {
      prisma.activity.findFirst.mockResolvedValue({
        id: 'sug-1',
        entityId: 'opp-1',
        type: 'followup_suggested',
        metadata: {
          status: 'SUGGESTED',
          ruleCode: 'STALE_TOUCH_NO_NEXT_STEP',
          title: 'Follow up',
          description: 'Desc',
          suggestedDueAt: '2025-02-15T09:00:00.000Z',
          dedupeKey: 'opp-1:STALE_TOUCH_NO_NEXT_STEP',
        },
        createdAt: new Date(),
      });
      prisma.activity.create.mockResolvedValue({
        id: 'task-1',
        metadata: { status: 'OPEN', createdFromSuggestionActivityId: 'sug-1' },
        createdAt: new Date(),
      });

      const result = await service.createTaskFromSuggestion('sug-1', 'tenant-1');

      expect(prisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'opportunity',
            entityId: 'opp-1',
            type: 'task_created',
            metadata: expect.objectContaining({
              createdFromSuggestionActivityId: 'sug-1',
              status: 'OPEN',
              dedupeKey: 'opp-1:STALE_TOUCH_NO_NEXT_STEP',
            }),
          }),
        }),
      );
      expect(result.id).toBe('task-1');
    });

    it('throws NotFoundException when suggestion not found', async () => {
      prisma.activity.findFirst.mockResolvedValue(null);
      await expect(service.createTaskFromSuggestion('missing', 'tenant-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when suggestion status is not SUGGESTED', async () => {
      prisma.activity.findFirst.mockResolvedValue({
        id: 'sug-1',
        entityId: 'opp-1',
        type: 'followup_suggested',
        metadata: { status: 'ACCEPTED' },
        createdAt: new Date(),
      });
      await expect(service.createTaskFromSuggestion('sug-1', 'tenant-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeTask', () => {
    it('creates task_completed activity', async () => {
      prisma.activity.findFirst.mockResolvedValue({
        id: 'task-1',
        entityId: 'opp-1',
        type: 'task_created',
        metadata: { status: 'OPEN' },
      });
      prisma.activity.create.mockResolvedValue({});

      await service.completeTask('task-1', 'tenant-1');

      expect(prisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'task_completed',
            entityId: 'opp-1',
            metadata: { taskActivityId: 'task-1', status: 'COMPLETED' },
          }),
        }),
      );
    });

    it('throws NotFoundException when task not found', async () => {
      prisma.activity.findFirst.mockResolvedValue(null);
      await expect(service.completeTask('missing', 'tenant-1')).rejects.toThrow(NotFoundException);
    });
  });
});
