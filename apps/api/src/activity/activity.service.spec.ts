import { Test, TestingModule } from '@nestjs/testing';
import { Activity } from '@crm/db';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowService } from '../workflow/workflow.service';
import { ActivityService } from './activity.service';
import { CreateActivityDto } from './dto/create-activity.dto';

describe('ActivityService', () => {
  let service: ActivityService;
  let prisma: PrismaService;
  let workflow: WorkflowService;

  const createdActivity: Activity = {
    id: 'act-1',
    entityType: 'opportunity',
    entityId: 'opp-1',
    type: 'note',
    payload: {},
    metadata: null,
    createdAt: new Date('2025-02-12T10:00:00Z'),
    updatedAt: new Date('2025-02-12T10:00:00Z'),
    deletedAt: null,
  };

  const mockPrisma = {
    activity: {
      create: jest.fn(),
    },
  };

  const mockWorkflow = {
    updateLastActivityAt: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.activity.create.mockResolvedValue(createdActivity);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WorkflowService, useValue: mockWorkflow },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
    prisma = module.get<PrismaService>(PrismaService);
    workflow = module.get<WorkflowService>(WorkflowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create (opportunity activity)', () => {
    it('updates opportunity lastActivityAt when entityType is opportunity', async () => {
      const dto: CreateActivityDto = {
        entityType: 'opportunity',
        entityId: 'opp-1',
        type: 'note',
        payload: { text: 'Note text' },
      };

      const result = await service.create(dto);

      expect(prisma.activity.create).toHaveBeenCalledWith({
        data: {
          entityType: dto.entityType,
          entityId: dto.entityId,
          type: dto.type,
          payload: { text: 'Note text' },
        },
      });
      expect(workflow.updateLastActivityAt).toHaveBeenCalledTimes(1);
      expect(workflow.updateLastActivityAt).toHaveBeenCalledWith(
        'opp-1',
        createdActivity.createdAt,
      );
      expect(result).toEqual(createdActivity);
    });

    it('does not call workflow when entityType is not opportunity', async () => {
      const dto: CreateActivityDto = {
        entityType: 'contact',
        entityId: 'contact-1',
        type: 'call',
        payload: {},
      };
      mockPrisma.activity.create.mockResolvedValue({
        ...createdActivity,
        entityType: 'contact',
        entityId: 'contact-1',
      });

      await service.create(dto);

      expect(workflow.updateLastActivityAt).not.toHaveBeenCalled();
    });
  });

  describe('createRaw (opportunity activity)', () => {
    it('updates opportunity lastActivityAt when entityType is opportunity', async () => {
      const data = {
        entityType: 'opportunity',
        entityId: 'opp-2',
        type: 'stage_change',
        payload: { from: 'prospecting', to: 'qualification' },
      };

      await service.createRaw(data);

      expect(workflow.updateLastActivityAt).toHaveBeenCalledWith(
        'opp-2',
        createdActivity.createdAt,
      );
    });

    it('does not call workflow when entityType is not opportunity', async () => {
      await service.createRaw({
        entityType: 'account',
        entityId: 'acc-1',
        type: 'note',
        payload: {},
      });

      expect(workflow.updateLastActivityAt).not.toHaveBeenCalled();
    });

    it('does not call workflow for non-touch activity type (followup_draft_created)', async () => {
      await service.createRaw({
        entityType: 'opportunity',
        entityId: 'opp-1',
        type: 'followup_draft_created',
        payload: {},
      });

      expect(workflow.updateLastActivityAt).not.toHaveBeenCalled();
    });
  });
});
