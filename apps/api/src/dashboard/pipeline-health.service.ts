import { ForbiddenException, Injectable } from '@nestjs/common';
import { User } from '@crm/db';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../auth/constants';
import { computeHealthScore } from '../opportunity/health-scoring';
import { evaluateForecast } from '../forecast-engine/forecast-engine.evaluate';
import type { PipelineHealthQueryDto } from './dto/pipeline-health-query.dto';

const OPEN_STAGES = ['prospecting', 'qualification', 'discovery', 'proposal', 'negotiation'] as const;
const STALE_TOUCH_DAYS = 7;
const ACTIVITY_TYPES_FOLLOWUP = [
  'followup_suggested',
  'task_created',
  'task_completed',
  'task_dismissed',
  'task_snoozed',
  'followup_draft_created',
] as const;

function daysSince(date: Date | null, ref: Date): number | null {
  if (date == null) return null;
  return Math.floor((ref.getTime() - date.getTime()) / 86400000);
}

function toNumber(amount: { toString(): string } | null): number {
  if (amount == null) return 0;
  const n = Number(amount.toString());
  return Number.isFinite(n) ? n : 0;
}

export interface PipelineHealthResponse {
  filtersEcho: {
    owner: string;
    stages: string[];
    status: string[];
    overdueOnly: boolean;
    staleOnly: boolean;
    sort: string;
    page: number;
    pageSize: number;
  };
  summary: {
    totalDeals: number;
    totalAmount: number;
    healthyCount: number;
    warningCount: number;
    criticalCount: number;
    atRiskAmount: number;
    overdueNextStepsCount: number;
    staleTouchCount: number;
  };
  topDrivers: Array<{ code: string; deals: number; amount: number }>;
  byStage: Array<{
    stage: string;
    deals: number;
    amount: number;
    avgDaysInStage: number | null;
    criticalPct: number;
  }>;
  queue: {
    total: number;
    page: number;
    pageSize: number;
    items: Array<{
      id: string;
      name: string;
      stage: string;
      amount: number | null;
      owner: { id: string; name: string; email?: string };
      nextFollowUpAt: string | null;
      daysSinceLastTouch: number | null;
      daysInStage: number | null;
      healthScore: number | null;
      healthStatus: 'healthy' | 'warning' | 'critical';
      healthSignals: Array<{ code: string; severity: string; message: string; penalty: number }>;
      followup: { hasSuggestion: boolean; hasOpenTask: boolean; hasDraft: boolean };
      winProbability: number;
      forecastCategory: string;
      expectedRevenue: number | null;
      forecastDrivers?: Array<{ code: string; label: string; impact: number }>;
    }>;
  };
  forecast: {
    totalAmount: number;
    weightedPipeline: number;
    commitAmount: number;
    commitWeighted: number;
    bestCaseAmount: number;
    bestCaseWeighted: number;
    byOwner: Array<{
      ownerId: string;
      ownerName: string;
      pipelineAmount: number;
      bestCaseAmount: number;
      commitAmount: number;
      weightedTotal: number;
    }>;
    byStage: Array<{
      stage: string;
      pipelineAmount: number;
      bestCaseAmount: number;
      commitAmount: number;
      weightedTotal: number;
    }>;
  };
}

interface EnrichedOpp {
  id: string;
  name: string;
  stage: string | null;
  amount: { toString(): string } | null;
  ownerId: string;
  ownerEmail: string;
  nextFollowUpAt: Date | null;
  daysSinceLastTouch: number | null;
  daysInStage: number | null;
  healthScore: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
  healthSignals: Array<{ code: string; severity: string; message: string; penalty: number }>;
  isOverdue: boolean;
  isStaleTouch: boolean;
  winProbability: number;
  forecastCategory: string;
  expectedRevenue: number | null;
  forecastDrivers: Array<{ code: string; label: string; impact: number }>;
}

@Injectable()
export class PipelineHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getPipelineHealth(
    currentUser: User,
    query: PipelineHealthQueryDto,
    tenantId: string,
  ): Promise<PipelineHealthResponse> {
    const isAdmin = currentUser.role === Role.ADMIN;
    let ownerParam = (query.owner ?? (isAdmin ? 'all' : 'me')).toLowerCase();
    if (!isAdmin) {
      if (ownerParam === 'all') ownerParam = 'me';
      else if (ownerParam !== 'me' && ownerParam !== currentUser.id) {
        throw new ForbiddenException('Only admins can filter by another user');
      }
    }

    const stagesFilter =
      query.stages?.trim()
        ? query.stages.split(',').map((s) => s.trim()).filter(Boolean)
        : [...OPEN_STAGES];
    const statusFilter = query.status?.trim()
      ? query.status.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
      : ['healthy', 'warning', 'critical'];
    const overdueOnly = query.overdueOnly === 'true';
    const staleOnly = query.staleOnly === 'true';
    const sort = query.sort ?? 'risk';
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));

    const ownerWhere =
      ownerParam === 'me'
        ? { ownerId: currentUser.id }
        : ownerParam === 'all'
          ? {}
          : { ownerId: ownerParam };

    const stageList = stagesFilter.length > 0 ? stagesFilter : ([...OPEN_STAGES] as string[]);
    const opportunities = await this.prisma.opportunity.findMany({
      where: {
        tenantId,
        ...ownerWhere,
        stage: { in: stageList },
      },
      select: {
        id: true,
        name: true,
        stage: true,
        amount: true,
        ownerId: true,
        lastActivityAt: true,
        lastStageChangedAt: true,
        nextFollowUpAt: true,
        owner: { select: { id: true, email: true } },
      },
    });

    type OppWithOwner = (typeof opportunities)[number];
    const now = new Date();
    const enriched: EnrichedOpp[] = opportunities.map((o: OppWithOwner) => {
      const daysSinceLastTouch = daysSince(o.lastActivityAt, now);
      const daysInStage = daysSince(o.lastStageChangedAt, now);
      const health = computeHealthScore({
        stage: o.stage,
        daysSinceLastTouch,
        daysInStage,
        nextFollowUpAt: o.nextFollowUpAt,
        now,
      });
      const amountNum = o.amount != null ? toNumber(o.amount) : null;
      const forecast = evaluateForecast(
        {
          stage: o.stage ?? 'prospecting',
          amount: amountNum,
          closeDate: null,
          daysSinceLastTouch,
          daysInStage,
          healthScore: health.healthScore,
          healthStatus: health.healthStatus,
          healthSignals: health.healthSignals,
          nextFollowUpAt: o.nextFollowUpAt,
        },
        now,
      );
      const isOverdue =
        o.nextFollowUpAt != null && o.nextFollowUpAt < now;
      const isStaleTouch =
        daysSinceLastTouch == null || daysSinceLastTouch >= STALE_TOUCH_DAYS;
      const owner = (o as { owner?: { id: string; email: string } }).owner;
      return {
        id: o.id,
        name: o.name,
        stage: o.stage ?? 'prospecting',
        amount: o.amount,
        ownerId: o.ownerId,
        ownerEmail: owner?.email ?? '',
        nextFollowUpAt: o.nextFollowUpAt,
        daysSinceLastTouch,
        daysInStage,
        healthScore: health.healthScore,
        healthStatus: health.healthStatus,
        healthSignals: health.healthSignals,
        isOverdue,
        isStaleTouch,
        winProbability: forecast.winProbability,
        forecastCategory: forecast.forecastCategory,
        expectedRevenue: forecast.expectedRevenue,
        forecastDrivers: forecast.drivers,
      };
    });

    let filtered = enriched.filter((o) => {
      if (!statusFilter.includes(o.healthStatus)) return false;
      if (overdueOnly && !o.isOverdue) return false;
      if (staleOnly && !o.isStaleTouch) return false;
      return true;
    });

    const signalCode = query.signalCode?.trim();
    if (signalCode) {
      filtered = filtered.filter((o) => o.healthSignals.some((s) => s.code === signalCode));
    }

    const totalFiltered = filtered.length;

    const summary = {
      totalDeals: filtered.length,
      totalAmount: filtered.reduce((s, o) => s + toNumber(o.amount), 0),
      healthyCount: filtered.filter((o) => o.healthStatus === 'healthy').length,
      warningCount: filtered.filter((o) => o.healthStatus === 'warning').length,
      criticalCount: filtered.filter((o) => o.healthStatus === 'critical').length,
      atRiskAmount: filtered
        .filter((o) => o.healthStatus === 'warning' || o.healthStatus === 'critical')
        .reduce((s, o) => s + toNumber(o.amount), 0),
      overdueNextStepsCount: filtered.filter((o) => o.isOverdue).length,
      staleTouchCount: filtered.filter((o) => o.isStaleTouch).length,
    };

    const driverMap = new Map<string, { deals: number; amount: number }>();
    for (const o of filtered) {
      for (const sig of o.healthSignals) {
        const code = sig.code;
        const cur = driverMap.get(code) ?? { deals: 0, amount: 0 };
        cur.deals += 1;
        cur.amount += toNumber(o.amount);
        driverMap.set(code, cur);
      }
    }
    const topDrivers = Array.from(driverMap.entries())
      .map(([code, v]) => ({ code, deals: v.deals, amount: v.amount }))
      .sort((a, b) => b.deals - a.deals)
      .slice(0, 10);

    const byStageMap = new Map<
      string,
      { deals: number; amount: number; daysInStageSum: number; daysInStageCount: number; critical: number }
    >();
    for (const o of filtered) {
      const stage = o.stage ?? '_other';
      const cur = byStageMap.get(stage) ?? {
        deals: 0,
        amount: 0,
        daysInStageSum: 0,
        daysInStageCount: 0,
        critical: 0,
      };
      cur.deals += 1;
      cur.amount += toNumber(o.amount);
      if (o.daysInStage != null) {
        cur.daysInStageSum += o.daysInStage;
        cur.daysInStageCount += 1;
      }
      if (o.healthStatus === 'critical') cur.critical += 1;
      byStageMap.set(stage, cur);
    }
    const byStage = Array.from(byStageMap.entries()).map(([stage, v]) => ({
      stage,
      deals: v.deals,
      amount: v.amount,
      avgDaysInStage:
        v.daysInStageCount > 0 ? v.daysInStageSum / v.daysInStageCount : null,
      criticalPct: v.deals > 0 ? (v.critical / v.deals) * 100 : 0,
    }));

    // Forecast rollups from filtered
    const weightedPipeline = filtered.reduce((s, o) => s + (o.expectedRevenue ?? 0), 0);
    const commitFiltered = filtered.filter((o) => o.forecastCategory === 'commit');
    const bestCaseFiltered = filtered.filter(
      (o) => o.forecastCategory === 'best_case' || o.forecastCategory === 'commit',
    );
    const forecastSummary = {
      totalAmount: filtered.reduce((s, o) => s + toNumber(o.amount), 0),
      weightedPipeline,
      commitAmount: commitFiltered.reduce((s, o) => s + toNumber(o.amount), 0),
      commitWeighted: commitFiltered.reduce((s, o) => s + (o.expectedRevenue ?? 0), 0),
      bestCaseAmount: bestCaseFiltered.reduce((s, o) => s + toNumber(o.amount), 0),
      bestCaseWeighted: bestCaseFiltered.reduce((s, o) => s + (o.expectedRevenue ?? 0), 0),
    };

    const forecastByOwnerMap = new Map<
      string,
      { ownerName: string; pipelineAmount: number; bestCaseAmount: number; commitAmount: number; weightedTotal: number }
    >();
    for (const o of filtered) {
      const cur = forecastByOwnerMap.get(o.ownerId) ?? {
        ownerName: o.ownerEmail,
        pipelineAmount: 0,
        bestCaseAmount: 0,
        commitAmount: 0,
        weightedTotal: 0,
      };
      cur.pipelineAmount += toNumber(o.amount);
      cur.weightedTotal += o.expectedRevenue ?? 0;
      if (o.forecastCategory === 'commit') {
        cur.commitAmount += toNumber(o.amount);
      }
      if (o.forecastCategory === 'best_case' || o.forecastCategory === 'commit') {
        cur.bestCaseAmount += toNumber(o.amount);
      }
      forecastByOwnerMap.set(o.ownerId, cur);
    }
    const forecastByOwner = Array.from(forecastByOwnerMap.entries()).map(([ownerId, v]) => ({
      ownerId,
      ownerName: v.ownerName,
      pipelineAmount: v.pipelineAmount,
      bestCaseAmount: v.bestCaseAmount,
      commitAmount: v.commitAmount,
      weightedTotal: v.weightedTotal,
    }));

    const forecastByStageMap = new Map<
      string,
      { pipelineAmount: number; bestCaseAmount: number; commitAmount: number; weightedTotal: number }
    >();
    for (const o of filtered) {
      const stage = o.stage ?? '_other';
      const cur = forecastByStageMap.get(stage) ?? {
        pipelineAmount: 0,
        bestCaseAmount: 0,
        commitAmount: 0,
        weightedTotal: 0,
      };
      cur.pipelineAmount += toNumber(o.amount);
      cur.weightedTotal += o.expectedRevenue ?? 0;
      if (o.forecastCategory === 'commit') cur.commitAmount += toNumber(o.amount);
      if (o.forecastCategory === 'best_case' || o.forecastCategory === 'commit') {
        cur.bestCaseAmount += toNumber(o.amount);
      }
      forecastByStageMap.set(stage, cur);
    }
    const forecastByStage = Array.from(forecastByStageMap.entries()).map(([stage, v]) => ({
      stage,
      pipelineAmount: v.pipelineAmount,
      bestCaseAmount: v.bestCaseAmount,
      commitAmount: v.commitAmount,
      weightedTotal: v.weightedTotal,
    }));

    const sortFn = (a: EnrichedOpp, b: EnrichedOpp): number => {
      switch (sort) {
        case 'risk':
          return (
            (a.healthStatus === 'critical' ? 2 : a.healthStatus === 'warning' ? 1 : 0) -
            (b.healthStatus === 'critical' ? 2 : b.healthStatus === 'warning' ? 1 : 0)
          ) || (a.healthScore - b.healthScore);
        case 'amount':
          return toNumber(b.amount) - toNumber(a.amount);
        case 'lastTouch':
          return (a.daysSinceLastTouch ?? 0) - (b.daysSinceLastTouch ?? 0);
        case 'stageAge':
          return (a.daysInStage ?? 0) - (b.daysInStage ?? 0);
        case 'overdue':
          return (a.isOverdue ? 1 : 0) - (b.isOverdue ? 1 : 0);
        default:
          return 0;
      }
    };
    filtered.sort(sortFn);

    const start = (page - 1) * pageSize;
    const queueItems = filtered.slice(start, start + pageSize);
    const queueIds = queueItems.map((o) => o.id);

    const activities =
      queueIds.length > 0
        ? await this.prisma.activity.findMany({
            where: {
              tenantId,
              entityType: 'opportunity',
              entityId: { in: queueIds },
              type: { in: [...ACTIVITY_TYPES_FOLLOWUP] },
              deletedAt: null,
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              entityId: true,
              type: true,
              metadata: true,
              createdAt: true,
            },
          })
        : [];

    const followupByOpp = new Map<
      string,
      { hasSuggestion: boolean; hasOpenTask: boolean; hasDraft: boolean }
    >();
    for (const id of queueIds) {
      followupByOpp.set(id, {
        hasSuggestion: false,
        hasOpenTask: false,
        hasDraft: false,
      });
    }

    const openTaskIds = new Set<string>();
    const taskSnoozedUntil = new Map<string, Date>();
    const dedupeKeysWithOpenTask = new Set<string>();

    for (const a of activities) {
      const meta = (a.metadata ?? {}) as Record<string, unknown>;
      if (a.type === 'task_created' && (meta.status as string) === 'OPEN') {
        openTaskIds.add(a.id);
        const dk = meta.dedupeKey as string | undefined;
        if (dk) dedupeKeysWithOpenTask.add(dk);
      }
      if (a.type === 'task_completed' || a.type === 'task_dismissed') {
        const taskId = meta.taskActivityId as string | undefined;
        if (taskId) openTaskIds.delete(taskId);
      }
      if (a.type === 'task_snoozed') {
        const taskId = meta.taskActivityId as string | undefined;
        const until = meta.snoozedUntil as string | undefined;
        if (taskId && until) taskSnoozedUntil.set(taskId, new Date(until));
      }
    }

    const draftBySuggestion = new Set<string>();
    const draftByTask = new Set<string>();
    for (const a of activities) {
      if (a.type !== 'followup_draft_created') continue;
      const m = (a.metadata ?? {}) as Record<string, unknown>;
      if ((m.status as string) !== 'DRAFT') continue;
      const sugId = m.suggestionActivityId as string | undefined;
      const taskId = m.taskActivityId as string | undefined;
      if (sugId) draftBySuggestion.add(sugId);
      if (taskId) draftByTask.add(taskId);
    }

    const suggestionIdsByOpp = new Map<string, Set<string>>();
    const openTaskIdsByOpp = new Map<string, Set<string>>();
    for (const a of activities) {
      const oppId = a.entityId;
      const meta = (a.metadata ?? {}) as Record<string, unknown>;
      if (a.type === 'followup_suggested' && (meta.status as string) === 'SUGGESTED') {
        const dk = meta.dedupeKey as string | undefined;
        if (dk && dedupeKeysWithOpenTask.has(dk)) continue;
        const set = suggestionIdsByOpp.get(oppId) ?? new Set();
        set.add(a.id);
        suggestionIdsByOpp.set(oppId, set);
      }
      if (a.type === 'task_created' && (meta.status as string) === 'OPEN' && openTaskIds.has(a.id)) {
        const until = taskSnoozedUntil.get(a.id);
        if (until && now < until) continue;
        const set = openTaskIdsByOpp.get(oppId) ?? new Set();
        set.add(a.id);
        openTaskIdsByOpp.set(oppId, set);
      }
    }

    for (const oppId of queueIds) {
      const flags = followupByOpp.get(oppId)!;
      const sugIds = suggestionIdsByOpp.get(oppId);
      const taskIds = openTaskIdsByOpp.get(oppId);
      flags.hasSuggestion = (sugIds?.size ?? 0) > 0;
      flags.hasOpenTask = (taskIds?.size ?? 0) > 0;
      flags.hasDraft = Boolean(
        (sugIds && [...sugIds].some((id) => draftBySuggestion.has(id))) ||
        (taskIds && [...taskIds].some((id) => draftByTask.has(id))),
      );
    }

    const queue = {
      total: totalFiltered,
      page,
      pageSize,
      items: queueItems.map((o) => ({
        id: o.id,
        name: o.name,
        stage: o.stage ?? 'prospecting',
        amount: o.amount != null ? toNumber(o.amount) : null,
        owner: {
          id: o.ownerId,
          name: o.ownerEmail,
          email: o.ownerEmail,
        },
        nextFollowUpAt: o.nextFollowUpAt ? o.nextFollowUpAt.toISOString() : null,
        daysSinceLastTouch: o.daysSinceLastTouch,
        daysInStage: o.daysInStage,
        healthScore: o.healthScore,
        healthStatus: o.healthStatus,
        healthSignals: o.healthSignals,
        followup: followupByOpp.get(o.id) ?? {
          hasSuggestion: false,
          hasOpenTask: false,
          hasDraft: false,
        },
        winProbability: o.winProbability,
        forecastCategory: o.forecastCategory,
        expectedRevenue: o.expectedRevenue,
        forecastDrivers: o.forecastDrivers,
      })),
    };

    const forecast = {
      ...forecastSummary,
      byOwner: forecastByOwner,
      byStage: forecastByStage,
    };

    return {
      filtersEcho: {
        owner: ownerParam,
        stages: stagesFilter,
        status: statusFilter,
        overdueOnly,
        staleOnly,
        sort,
        page,
        pageSize,
      },
      summary,
      topDrivers,
      byStage,
      queue,
      forecast,
    };
  }
}
