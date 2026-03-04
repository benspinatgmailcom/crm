import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowService } from '../../workflow/workflow.service';
import { AiAdapter } from '../../ai/adapter/ai-adapter.interface';
import { DraftContextBuilder } from './draft-context.builder';
import { FollowUpDraftService } from './followup-draft.service';

describe('FollowUpDraftService', () => {
  let service: FollowUpDraftService;
  let prisma: PrismaService;
  let workflow: WorkflowService;

  const mockDraft = {
    id: 'draft-1',
    entityId: 'opp-1',
    metadata: { status: 'DRAFT', suggestionActivityId: 'sug-1' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowUpDraftService,
        {
          provide: PrismaService,
          useValue: {
            activity: { findFirst: jest.fn(), create: jest.fn() },
          },
        },
        { provide: WorkflowService, useValue: { updateLastActivityAt: jest.fn() } },
        {
          provide: AiAdapter,
          useValue: {
            chat: jest.fn().mockResolvedValue(
              JSON.stringify({
                subject: 'Follow up',
                body: 'Hi, checking in.',
                assumptions: [],
                questionsToConfirm: [],
              }),
            ),
          },
        },
        {
          provide: DraftContextBuilder,
          useValue: {
            buildFromSuggestion: jest.fn().mockResolvedValue({
              opportunity: { id: 'opp-1', name: 'Opp', stage: 'proposal', lastActivityAt: null, lastStageChangedAt: null, nextFollowUpAt: null, daysSinceLastTouch: 7, daysInStage: 14, healthStatus: 'warning', healthSignals: [] },
              trigger: { ruleCode: 'STALE', title: 'Follow up', description: 'Desc', reasonCodes: [], severity: 'warning' },
              recentActivitySummary: [],
              constraints: { groundingRules: [] },
            }),
            buildFromTask: jest.fn().mockResolvedValue({
              opportunity: { id: 'opp-1', name: 'Opp', stage: 'proposal', lastActivityAt: null, lastStageChangedAt: null, nextFollowUpAt: null, daysSinceLastTouch: 7, daysInStage: 14, healthStatus: 'warning', healthSignals: [] },
              trigger: { ruleCode: 'TASK', title: 'Task', description: 'Desc', reasonCodes: [], severity: 'warning' },
              recentActivitySummary: [],
              constraints: { groundingRules: [] },
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FollowUpDraftService>(FollowUpDraftService);
    prisma = module.get<PrismaService>(PrismaService);
    workflow = module.get<WorkflowService>(WorkflowService);
    (prisma.activity.findFirst as jest.Mock).mockResolvedValue({ entityId: 'opp-1' });
    (prisma.activity.create as jest.Mock).mockResolvedValue({
      id: 'draft-1',
      metadata: { subject: 'Follow up', body: 'Hi', status: 'DRAFT' },
    });
  });

  describe('generateDraftFromSuggestion', () => {
    it('creates followup_draft_created activity and returns id, subject, body, metadata', async () => {
      const result = await service.generateDraftFromSuggestion('sug-1', {});

      expect(prisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'followup_draft_created',
            entityId: 'opp-1',
            metadata: expect.objectContaining({
              suggestionActivityId: 'sug-1',
              status: 'DRAFT',
              subject: 'Follow up',
              body: 'Hi, checking in.',
            }),
          }),
        }),
      );
      expect(result.id).toBe('draft-1');
      expect(result.subject).toBe('Follow up');
      expect(result.body).toBe('Hi, checking in.');
    });
  });

  describe('markDraftSent', () => {
    it('creates followup_sent activity and calls updateLastActivityAt', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(mockDraft);
      (prisma.activity.create as jest.Mock).mockResolvedValue({});

      await service.markDraftSent('draft-1', { channel: 'email', notes: 'Sent via Gmail' });

      expect(prisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'followup_sent',
            entityId: 'opp-1',
            metadata: expect.objectContaining({
              draftActivityId: 'draft-1',
              channel: 'email',
              status: 'SENT',
              notes: 'Sent via Gmail',
            }),
          }),
        }),
      );
      expect(workflow.updateLastActivityAt).toHaveBeenCalledWith('opp-1', expect.any(Date));
    });

    it('throws NotFoundException when draft not found', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.markDraftSent('missing', { channel: 'email' })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when draft status is not DRAFT', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue({ ...mockDraft, metadata: { status: 'SENT' } });

      await expect(service.markDraftSent('draft-1', { channel: 'email' })).rejects.toThrow(BadRequestException);
    });
  });
});
