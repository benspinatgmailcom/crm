import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { computeHealthScore } from '../../opportunity/health-scoring';
import type { DraftContextBrief } from './draft-dto';

const ENTITY_OPPORTUNITY = 'opportunity';
const RECENT_ACTIVITY_LIMIT = 12;

/** Activity types to include in recent activity summary (exclude system/noise) */
const CONTENT_ACTIVITY_TYPES = [
  'note',
  'call',
  'meeting',
  'email',
  'task',
  'stage_change',
  'file_uploaded',
  'file_deleted',
  'lead_converted',
  'ai_summary',
  'ai_recommendation',
  'ai_email_draft',
  'ai_deal_brief',
];

function daysSince(date: Date | null, ref: Date): number | null {
  if (date == null) return null;
  return Math.floor((ref.getTime() - date.getTime()) / 86400000);
}

function safeSummary(p: Record<string, unknown>, type: string): { titleOrSummary?: string; notes?: string } {
  const titleOrSummary =
    type === 'note' ? (p.text as string)?.slice(0, 200)
    : type === 'call' || type === 'meeting' ? (p.summary as string)?.slice(0, 200)
    : type === 'email' ? (p.subject as string)?.slice(0, 200)
    : type === 'task' ? (p.title as string)?.slice(0, 200)
    : type === 'ai_summary' ? (p.text as string)?.slice(0, 200)
    : type === 'ai_deal_brief' ? (p.briefMarkdown as string)?.slice(0, 200)
    : undefined;
  const notes = (p.outcome as string) ?? (p.nextStep as string) ?? undefined;
  return { titleOrSummary, notes };
}

@Injectable()
export class DraftContextBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async buildFromSuggestion(suggestionActivityId: string): Promise<DraftContextBrief> {
    const suggestion = await this.prisma.activity.findFirst({
      where: { id: suggestionActivityId, entityType: ENTITY_OPPORTUNITY, type: 'followup_suggested', deletedAt: null },
      select: { id: true, entityId: true, metadata: true },
    });
    if (!suggestion) throw new NotFoundException(`Suggestion ${suggestionActivityId} not found`);
    const opportunityId = suggestion.entityId;
    const meta = (suggestion.metadata ?? {}) as Record<string, unknown>;
    const trigger = {
      ruleCode: String(meta.ruleCode ?? ''),
      severity: String(meta.severity ?? ''),
      reasonCodes: Array.isArray(meta.reasonCodes) ? (meta.reasonCodes as string[]) : [],
      title: String(meta.title ?? 'Follow-up'),
      description: String(meta.description ?? ''),
    };
    return this.buildBrief(opportunityId, trigger, { suggestionActivityId });
  }

  async buildFromTask(taskActivityId: string): Promise<DraftContextBrief> {
    const task = await this.prisma.activity.findFirst({
      where: { id: taskActivityId, entityType: ENTITY_OPPORTUNITY, type: 'task_created', deletedAt: null },
      select: { id: true, entityId: true, metadata: true },
    });
    if (!task) throw new NotFoundException(`Task ${taskActivityId} not found`);
    const opportunityId = task.entityId;
    const meta = (task.metadata ?? {}) as Record<string, unknown>;
    const trigger = {
      ruleCode: String(meta.ruleCode ?? ''),
      severity: 'warning',
      reasonCodes: [] as string[],
      title: String(meta.title ?? 'Task'),
      description: String(meta.description ?? ''),
    };
    return this.buildBrief(opportunityId, trigger, { taskActivityId });
  }

  private async buildBrief(
    opportunityId: string,
    trigger: DraftContextBrief['trigger'],
    source: { suggestionActivityId?: string; taskActivityId?: string },
  ): Promise<DraftContextBrief> {
    const opp = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: {
        id: true,
        name: true,
        stage: true,
        amount: true,
        closeDate: true,
        lastActivityAt: true,
        lastStageChangedAt: true,
        nextFollowUpAt: true,
      },
    });
    if (!opp) throw new NotFoundException(`Opportunity ${opportunityId} not found`);

    const now = new Date();
    const daysSinceLastTouch = daysSince(opp.lastActivityAt, now);
    const daysInStage = daysSince(opp.lastStageChangedAt, now);
    const health = computeHealthScore({
      stage: opp.stage,
      daysSinceLastTouch,
      daysInStage,
      nextFollowUpAt: opp.nextFollowUpAt,
      now,
    });

    const recentActivities = await this.prisma.activity.findMany({
      where: {
        entityType: ENTITY_OPPORTUNITY,
        entityId: opportunityId,
        type: { in: CONTENT_ACTIVITY_TYPES },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ACTIVITY_LIMIT,
      select: { id: true, type: true, payload: true, createdAt: true },
    });

    const recentActivitySummary = recentActivities.map((a) => {
      const p = (a.payload ?? {}) as Record<string, unknown>;
      const { titleOrSummary, notes } = safeSummary(p, a.type);
      return {
        id: a.id,
        type: a.type,
        createdAt: a.createdAt.toISOString(),
        titleOrSummary,
        notes,
      };
    });

    return {
      opportunity: {
        id: opp.id,
        name: opp.name,
        stage: opp.stage,
        amount: opp.amount != null ? String(opp.amount) : null,
        closeDate: opp.closeDate?.toISOString() ?? null,
        nextFollowUpAt: opp.nextFollowUpAt?.toISOString() ?? null,
        lastActivityAt: opp.lastActivityAt?.toISOString() ?? null,
        lastStageChangedAt: opp.lastStageChangedAt?.toISOString() ?? null,
        daysSinceLastTouch,
        daysInStage,
        healthStatus: health.healthStatus,
        healthSignals: health.healthSignals.map((s) => ({ code: s.code, message: s.message })),
      },
      trigger,
      recentActivitySummary,
      constraints: {
        groundingRules: [
          'Do not invent specific meetings, dates, promises, or attachments unless evidenced by the recent activities.',
          'If data is missing, use neutral language or placeholders and add items to questionsToConfirm.',
          'Keep tone and length as requested.',
        ],
      },
    };
  }
}
