import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@crm/db';
import { PrismaService } from '../prisma/prisma.service';
import { computeHealthScore } from '../opportunity/health-scoring';
import { evaluateOpportunityForFollowups } from './followup-engine.evaluate';
import type { SuggestionSpec } from './followup-engine.types';
import type { FollowupSuggestionMetadata, TaskCreatedMetadata, TaskStateChangeMetadata } from './followup-metadata.types';

const ENTITY_TYPE_OPPORTUNITY = 'opportunity';
const TYPES_SUGGESTION = 'followup_suggested';
const TYPES_TASK = 'task_created';
const TYPES_STATE = ['task_completed', 'task_dismissed', 'task_snoozed'] as const;

interface OpportunityRow {
  id: string;
  stage: string | null;
  lastActivityAt: Date | null;
  lastStageChangedAt: Date | null;
  nextFollowUpAt: Date | null;
}

function daysSince(date: Date | null, ref: Date): number | null {
  if (date == null) return null;
  return Math.floor((ref.getTime() - date.getTime()) / 86400000);
}

@Injectable()
export class FollowUpService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate follow-up suggestions for all open opportunities.
   * Fetches opportunities in one query, evaluates in-memory, bulk-fetches activities for dedupe, then creates new suggestions where allowed.
   */
  async generateSuggestionsForOpenOpportunities(now: Date = new Date()): Promise<{ created: number; skipped: number; errors: number }> {
    const openStages = ['prospecting', 'qualification', 'discovery', 'proposal', 'negotiation'];
    const opportunities = await this.prisma.opportunity.findMany({
      where: { stage: { in: openStages } },
      select: {
        id: true,
        stage: true,
        lastActivityAt: true,
        lastStageChangedAt: true,
        nextFollowUpAt: true,
      },
    });

    const oppsWithHealth: Array<OpportunityRow & { daysSinceLastTouch: number | null; daysInStage: number | null; healthStatus: 'healthy' | 'warning' | 'critical'; healthSignals: Array<{ code: string; severity: string; message: string; penalty: number }> }> = [];
    for (const o of opportunities) {
      const daysSinceLastTouch = daysSince(o.lastActivityAt, now);
      const daysInStage = daysSince(o.lastStageChangedAt, now);
      const health = computeHealthScore({
        stage: o.stage,
        daysSinceLastTouch,
        daysInStage,
        nextFollowUpAt: o.nextFollowUpAt,
        now,
      });
      oppsWithHealth.push({
        ...o,
        daysSinceLastTouch,
        daysInStage,
        healthStatus: health.healthStatus,
        healthSignals: health.healthSignals,
      });
    }

    const allSpecs: Array<{ opportunityId: string; spec: SuggestionSpec }> = [];
    for (const opp of oppsWithHealth) {
      const specs = evaluateOpportunityForFollowups(
        {
          opportunityId: opp.id,
          stage: opp.stage,
          nextFollowUpAt: opp.nextFollowUpAt,
          daysSinceLastTouch: opp.daysSinceLastTouch,
          daysInStage: opp.daysInStage,
          healthStatus: opp.healthStatus,
          healthSignals: opp.healthSignals,
        },
        now,
      );
      for (const spec of specs) {
        allSpecs.push({ opportunityId: opp.id, spec });
      }
    }

    if (allSpecs.length === 0) {
      return { created: 0, skipped: 0, errors: 0 };
    }

    const opportunityIds = [...new Set(allSpecs.map((s) => s.opportunityId))];
    const activities = await this.prisma.activity.findMany({
      where: {
        entityType: ENTITY_TYPE_OPPORTUNITY,
        entityId: { in: opportunityIds },
        type: { in: [TYPES_SUGGESTION, TYPES_TASK, ...TYPES_STATE] },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, entityId: true, type: true, metadata: true, createdAt: true },
    });

    const byDedupe = new Map<
      string,
      {
        openTask: boolean;
        lastSuggestionAt: Date | null;
        lastDismissedAt: Date | null;
        lastSnoozedUntil: Date | null;
      }
    >();

    for (const a of activities) {
      const meta = a.metadata as Record<string, unknown> | null;
      const dedupeKey = meta?.dedupeKey as string | undefined;
      if (!dedupeKey) continue;
      const key = `${a.entityId}:${dedupeKey}`;
      if (!byDedupe.has(key)) {
        byDedupe.set(key, {
          openTask: false,
          lastSuggestionAt: null,
          lastDismissedAt: null,
          lastSnoozedUntil: null,
        });
      }
      const entry = byDedupe.get(key)!;
      if (a.type === TYPES_TASK && (meta?.status as string) === 'OPEN') {
        entry.openTask = true;
      }
      if (a.type === TYPES_SUGGESTION && (meta?.status as string) === 'SUGGESTED') {
        if (entry.lastSuggestionAt == null || a.createdAt > entry.lastSuggestionAt) {
          entry.lastSuggestionAt = a.createdAt;
        }
      }
      if (a.type === 'task_dismissed') {
        const taskId = meta?.taskActivityId as string | undefined;
        if (taskId) {
          const taskAct = activities.find((x) => x.id === taskId && x.type === TYPES_TASK);
          if (taskAct && (taskAct.metadata as Record<string, unknown>)?.dedupeKey === dedupeKey) {
            if (entry.lastDismissedAt == null || a.createdAt > entry.lastDismissedAt) {
              entry.lastDismissedAt = a.createdAt;
            }
          }
        }
      }
      if (a.type === 'task_snoozed') {
        const taskId = meta?.taskActivityId as string | undefined;
        const until = meta?.snoozedUntil as string | undefined;
        if (taskId && until) {
          const taskAct = activities.find((x) => x.id === taskId && x.type === TYPES_TASK);
          if (taskAct && (taskAct.metadata as Record<string, unknown>)?.dedupeKey === dedupeKey) {
            const untilDate = new Date(until);
            if (entry.lastSnoozedUntil == null || untilDate > entry.lastSnoozedUntil) {
              entry.lastSnoozedUntil = untilDate;
            }
          }
        }
      }
    }

    let created = 0;
    let skipped = 0;
    for (const { opportunityId, spec } of allSpecs) {
      const key = `${opportunityId}:${spec.dedupeKey}`;
      const entry = byDedupe.get(key);
      if (entry?.openTask) {
        skipped++;
        continue;
      }
      const cooldownStart = entry?.lastSuggestionAt ?? entry?.lastDismissedAt ?? null;
      if (cooldownStart) {
        const cooldownEnd = new Date(cooldownStart);
        cooldownEnd.setDate(cooldownEnd.getDate() + spec.cooldownDays);
        if (now < cooldownEnd) {
          skipped++;
          continue;
        }
      }
      if (entry?.lastSnoozedUntil && now < entry.lastSnoozedUntil) {
        skipped++;
        continue;
      }

      try {
        await this.prisma.activity.create({
          data: {
            entityType: ENTITY_TYPE_OPPORTUNITY,
            entityId: opportunityId,
            type: TYPES_SUGGESTION,
            payload: {},
            metadata: {
              ruleCode: spec.ruleCode,
              title: spec.title,
              description: spec.description,
              suggestedDueAt: spec.suggestedDueAt.toISOString(),
              severity: spec.severity,
              dedupeKey: spec.dedupeKey,
              cooldownDays: spec.cooldownDays,
              reasonCodes: spec.reasonCodes,
              status: 'SUGGESTED',
            } as Prisma.InputJsonValue,
          },
        });
        created++;
        byDedupe.set(key, {
          ...entry,
          lastSuggestionAt: now,
          openTask: entry?.openTask ?? false,
          lastDismissedAt: entry?.lastDismissedAt ?? null,
          lastSnoozedUntil: entry?.lastSnoozedUntil ?? null,
        });
      } catch {
        skipped++;
      }
    }

    return { created, skipped, errors: 0 };
  }

  /**
   * List suggestions (SUGGESTED, not superseded by open task) and open tasks for an opportunity.
   * Includes latest draft per suggestion/task when present.
   */
  async listOpportunityFollowups(opportunityId: string): Promise<{
    suggestions: Array<{
      id: string;
      metadata: FollowupSuggestionMetadata;
      createdAt: Date;
      latestDraft?: { id: string; subject: string; body: string; metadata: Record<string, unknown>; createdAt: Date };
    }>;
    openTasks: Array<{
      id: string;
      metadata: TaskCreatedMetadata;
      createdAt: Date;
      snoozedUntil?: Date;
      latestDraft?: { id: string; subject: string; body: string; metadata: Record<string, unknown>; createdAt: Date };
    }>;
  }> {
    const [activities, drafts] = await Promise.all([
      this.prisma.activity.findMany({
        where: {
          entityType: ENTITY_TYPE_OPPORTUNITY,
          entityId: opportunityId,
          type: { in: [TYPES_SUGGESTION, TYPES_TASK, ...TYPES_STATE] },
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, metadata: true, createdAt: true },
      }),
      this.prisma.activity.findMany({
        where: {
          entityType: ENTITY_TYPE_OPPORTUNITY,
          entityId: opportunityId,
          type: 'followup_draft_created',
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, metadata: true, createdAt: true },
      }),
    ]);

    const openTaskIds = new Set<string>();
    const taskSnoozedUntil = new Map<string, Date>();
    const dedupeKeysWithOpenTask = new Set<string>();

    for (const a of activities) {
      const meta = a.metadata as Record<string, unknown> | null;
      if (a.type === TYPES_TASK && (meta?.status as string) === 'OPEN') {
        openTaskIds.add(a.id);
        const dk = meta?.dedupeKey as string | undefined;
        if (dk) dedupeKeysWithOpenTask.add(dk);
      }
      if (a.type === 'task_completed' || a.type === 'task_dismissed') {
        const taskId = meta?.taskActivityId as string | undefined;
        if (taskId) openTaskIds.delete(taskId);
      }
      if (a.type === 'task_snoozed') {
        const taskId = meta?.taskActivityId as string | undefined;
        const until = meta?.snoozedUntil as string | undefined;
        if (taskId && until) taskSnoozedUntil.set(taskId, new Date(until));
      }
    }

    const latestDraftBySuggestion = new Map<string, { id: string; subject: string; body: string; metadata: Record<string, unknown>; createdAt: Date }>();
    const latestDraftByTask = new Map<string, { id: string; subject: string; body: string; metadata: Record<string, unknown>; createdAt: Date }>();
    for (const d of drafts) {
      const m = (d.metadata ?? {}) as Record<string, unknown>;
      if ((m.status as string) !== 'DRAFT') continue;
      const sugId = m.suggestionActivityId as string | undefined;
      const taskId = m.taskActivityId as string | undefined;
      const subject = String(m.subject ?? '');
      const body = String(m.body ?? '');
      const draftRow = { id: d.id, subject, body, metadata: m, createdAt: d.createdAt };
      if (sugId && !latestDraftBySuggestion.has(sugId)) latestDraftBySuggestion.set(sugId, draftRow);
      if (taskId && !latestDraftByTask.has(taskId)) latestDraftByTask.set(taskId, draftRow);
    }

    const now = new Date();
    const suggestions: Array<{
      id: string;
      metadata: FollowupSuggestionMetadata;
      createdAt: Date;
      latestDraft?: { id: string; subject: string; body: string; metadata: Record<string, unknown>; createdAt: Date };
    }> = [];
    const openTasks: Array<{
      id: string;
      metadata: TaskCreatedMetadata;
      createdAt: Date;
      snoozedUntil?: Date;
      latestDraft?: { id: string; subject: string; body: string; metadata: Record<string, unknown>; createdAt: Date };
    }> = [];

    for (const a of activities) {
      const meta = a.metadata as Record<string, unknown> | null;
      if (a.type === TYPES_SUGGESTION && (meta?.status as string) === 'SUGGESTED') {
        const dk = meta?.dedupeKey as string | undefined;
        if (dk && dedupeKeysWithOpenTask.has(dk)) continue;
        suggestions.push({
          id: a.id,
          metadata: meta as unknown as FollowupSuggestionMetadata,
          createdAt: a.createdAt,
          latestDraft: latestDraftBySuggestion.get(a.id),
        });
      }
      if (a.type === TYPES_TASK && (meta?.status as string) === 'OPEN' && openTaskIds.has(a.id)) {
        const until = taskSnoozedUntil.get(a.id);
        if (until && now < until) continue;
        openTasks.push({
          id: a.id,
          metadata: meta as unknown as TaskCreatedMetadata,
          createdAt: a.createdAt,
          snoozedUntil: until,
          latestDraft: latestDraftByTask.get(a.id),
        });
      }
    }

    return { suggestions, openTasks };
  }

  /**
   * List all follow-up suggestions and open tasks across opportunities, with optional assignee and opportunity filter.
   */
  async listAllFollowups(
    assignee: string,
    opportunityIdFilter: string | undefined,
    currentUserId: string,
    isAdmin: boolean,
  ): Promise<{ items: Array<{ kind: 'suggestion' | 'openTask'; id: string; opportunityId: string; opportunityName: string; ownerId: string | null; ownerEmail: string | null; title: string; description?: string; dueAt: string; createdAt: string; snoozedUntil?: string; severity?: 'warning' | 'critical' }> }> {
    const where: { ownerId?: string; id?: string } = {};
    if (assignee === 'me') {
      where.ownerId = currentUserId;
    } else if (assignee !== 'all' && isAdmin && assignee) {
      where.ownerId = assignee;
    } else if (assignee !== 'all') {
      where.ownerId = currentUserId;
    }
    if (opportunityIdFilter) {
      where.id = opportunityIdFilter;
    }

    const opportunities = await this.prisma.opportunity.findMany({
      where,
      select: { id: true, name: true, ownerId: true, owner: { select: { email: true } } },
    });

    const items: Array<{
      kind: 'suggestion' | 'openTask';
      id: string;
      opportunityId: string;
      opportunityName: string;
      ownerId: string | null;
      ownerEmail: string | null;
      title: string;
      description?: string;
      dueAt: string;
      createdAt: string;
      snoozedUntil?: string;
      severity?: 'warning' | 'critical';
    }> = [];

    for (const opp of opportunities) {
      const { suggestions: sugs, openTasks: tasks } = await this.listOpportunityFollowups(opp.id);
      const ownerEmail = opp.owner?.email ?? null;
      for (const s of sugs) {
        items.push({
          kind: 'suggestion',
          id: s.id,
          opportunityId: opp.id,
          opportunityName: opp.name,
          ownerId: opp.ownerId,
          ownerEmail,
          title: s.metadata.title,
          description: s.metadata.description,
          dueAt: s.metadata.suggestedDueAt,
          createdAt: s.createdAt.toISOString(),
          severity: s.metadata.severity,
        });
      }
      for (const t of tasks) {
        items.push({
          kind: 'openTask',
          id: t.id,
          opportunityId: opp.id,
          opportunityName: opp.name,
          ownerId: opp.ownerId,
          ownerEmail,
          title: t.metadata.title,
          description: t.metadata.description,
          dueAt: t.metadata.dueAt,
          createdAt: t.createdAt.toISOString(),
          snoozedUntil: t.snoozedUntil?.toISOString(),
        });
      }
    }

    items.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    return { items };
  }

  /**
   * Create a task from a suggestion activity. Writes task_created and does not update suggestion (immutable).
   */
  async createTaskFromSuggestion(suggestionActivityId: string): Promise<{ id: string; metadata: TaskCreatedMetadata; createdAt: Date }> {
    const suggestion = await this.prisma.activity.findFirst({
      where: { id: suggestionActivityId, deletedAt: null, type: TYPES_SUGGESTION },
    });
    if (!suggestion) throw new NotFoundException(`Suggestion ${suggestionActivityId} not found`);
    const meta = suggestion.metadata as Record<string, unknown> | null;
    if ((meta?.status as string) !== 'SUGGESTED') throw new BadRequestException('Suggestion is not in SUGGESTED status');
    const entityId = suggestion.entityId;
    const ruleCode = meta?.ruleCode as string;
    const title = meta?.title as string;
    const description = meta?.description as string;
    const suggestedDueAt = meta?.suggestedDueAt as string;
    const dedupeKey = meta?.dedupeKey as string;
    const dueAt = suggestedDueAt ? new Date(suggestedDueAt) : new Date();
    const task = await this.prisma.activity.create({
      data: {
        entityType: ENTITY_TYPE_OPPORTUNITY,
        entityId,
        type: TYPES_TASK,
        payload: {},
        metadata: {
          ruleCode,
          title,
          description,
          dueAt: dueAt.toISOString(),
          priority: 'medium',
          status: 'OPEN',
          dedupeKey,
          createdFromSuggestionActivityId: suggestionActivityId,
        } as Prisma.InputJsonValue,
      },
    });
    return {
      id: task.id,
      metadata: task.metadata as unknown as TaskCreatedMetadata,
      createdAt: task.createdAt,
    };
  }

  /**
   * Mark a task as completed. Creates task_completed activity.
   */
  async completeTask(taskActivityId: string): Promise<void> {
    await this.ensureOpenTask(taskActivityId);
    await this.prisma.activity.create({
      data: {
        entityType: ENTITY_TYPE_OPPORTUNITY,
        entityId: await this.getEntityIdForTask(taskActivityId),
        type: 'task_completed',
        payload: {},
        metadata: { taskActivityId, status: 'COMPLETED' } as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Dismiss a task. Creates task_dismissed activity.
   */
  async dismissTask(taskActivityId: string): Promise<void> {
    await this.ensureOpenTask(taskActivityId);
    await this.prisma.activity.create({
      data: {
        entityType: ENTITY_TYPE_OPPORTUNITY,
        entityId: await this.getEntityIdForTask(taskActivityId),
        type: 'task_dismissed',
        payload: {},
        metadata: { taskActivityId, status: 'DISMISSED' } as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Snooze a task until a given time. Creates task_snoozed activity.
   */
  async snoozeTask(taskActivityId: string, until: Date): Promise<void> {
    await this.ensureOpenTask(taskActivityId);
    await this.prisma.activity.create({
      data: {
        entityType: ENTITY_TYPE_OPPORTUNITY,
        entityId: await this.getEntityIdForTask(taskActivityId),
        type: 'task_snoozed',
        payload: {},
        metadata: {
          taskActivityId,
          status: 'SNOOZED',
          snoozedUntil: until.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async ensureOpenTask(taskActivityId: string): Promise<void> {
    const task = await this.prisma.activity.findFirst({
      where: { id: taskActivityId, type: TYPES_TASK, deletedAt: null },
    });
    if (!task) throw new NotFoundException(`Task ${taskActivityId} not found`);
    const meta = task.metadata as Record<string, unknown> | null;
    if ((meta?.status as string) !== 'OPEN') throw new BadRequestException('Task is not open');
  }

  private async getEntityIdForTask(taskActivityId: string): Promise<string> {
    const task = await this.prisma.activity.findFirst({
      where: { id: taskActivityId, type: TYPES_TASK, deletedAt: null },
      select: { entityId: true },
    });
    if (!task) throw new NotFoundException(`Task ${taskActivityId} not found`);
    return task.entityId;
  }
}
