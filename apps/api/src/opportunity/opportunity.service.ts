import { Injectable, NotFoundException } from '@nestjs/common';
import { Opportunity, Prisma } from '@crm/db';
import { PaginatedResult } from '../common/pagination.dto';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { computeHealthScore } from './health-scoring';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { QueryOpportunityDto } from './dto/query-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

@Injectable()
export class OpportunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  async create(dto: CreateOpportunityDto): Promise<Opportunity> {
    const account = await this.prisma.account.findUnique({ where: { id: dto.accountId } });
    if (!account) throw new NotFoundException(`Account ${dto.accountId} not found`);

    return await this.prisma.opportunity.create({
      data: {
        accountId: dto.accountId,
        name: dto.name,
        amount: dto.amount != null ? dto.amount : undefined,
        stage: dto.stage ?? 'prospecting',
        probability: dto.probability,
        closeDate: dto.closeDate ? new Date(dto.closeDate) : undefined,
      },
    });
  }

  private static readonly PIPELINE_STAGES = [
    'prospecting',
    'qualification',
    'discovery',
    'proposal',
    'negotiation',
    'closed-won',
    'closed-lost',
  ] as const;

  /** Days from date to ref; null if date is null. Uses floor for whole days. */
  private static daysSince(date: Date | null, ref: Date): number | null {
    if (date == null) return null;
    return Math.floor((ref.getTime() - date.getTime()) / 86400000);
  }

  async getPipeline(): Promise<Record<string, Array<{
    id: string;
    name: string;
    amount: { toString(): string } | null;
    closeDate: Date | null;
    stage: string | null;
    accountId: string;
    accountName: string;
    daysSinceLastTouch: number | null;
    daysInStage: number | null;
    healthScore: number;
    healthStatus: 'healthy' | 'warning' | 'critical';
    healthSignals: Array<{ code: string; severity: string; message: string; penalty: number }>;
  }>>> {
    const opportunities = await this.prisma.opportunity.findMany({
      select: {
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
      },
    });

    const now = new Date();
    const result: Record<string, Array<{
      id: string;
      name: string;
      amount: { toString(): string } | null;
      closeDate: Date | null;
      stage: string | null;
      accountId: string;
      accountName: string;
      daysSinceLastTouch: number | null;
      daysInStage: number | null;
      healthScore: number;
      healthStatus: 'healthy' | 'warning' | 'critical';
      healthSignals: Array<{ code: string; severity: string; message: string; penalty: number }>;
    }>> = {};
    for (const s of OpportunityService.PIPELINE_STAGES) {
      result[s] = [];
    }
    result['_other'] = [];

    for (const o of opportunities) {
      const stage = o.stage || 'prospecting';
      const daysSinceLastTouch = OpportunityService.daysSince(o.lastActivityAt, now);
      const daysInStage = OpportunityService.daysSince(o.lastStageChangedAt, now);
      const health = computeHealthScore({
        stage: o.stage,
        daysSinceLastTouch,
        daysInStage,
        nextFollowUpAt: o.nextFollowUpAt,
        now,
      });
      const entry = {
        id: o.id,
        name: o.name,
        amount: o.amount,
        closeDate: o.closeDate,
        stage: o.stage,
        accountId: o.accountId,
        accountName: o.account.name,
        daysSinceLastTouch,
        daysInStage,
        healthScore: health.healthScore,
        healthStatus: health.healthStatus,
        healthSignals: health.healthSignals,
      };
      if (OpportunityService.PIPELINE_STAGES.includes(stage as (typeof OpportunityService.PIPELINE_STAGES)[number])) {
        result[stage].push(entry);
      } else {
        result['_other'].push(entry);
      }
    }

    return result;
  }

  async findAll(query: QueryOpportunityDto): Promise<
    PaginatedResult<
      Opportunity & {
        daysSinceLastTouch: number | null;
        daysInStage: number | null;
        healthScore: number;
        healthStatus: 'healthy' | 'warning' | 'critical';
        healthSignals: Array<{ code: string; severity: string; message: string; penalty: number }>;
      }
    >
  > {
    const { page = 1, pageSize = 20, name, accountId, stage, sortBy = 'createdAt', sortDir = 'desc' } = query;

    const where: Prisma.OpportunityWhereInput = {};
    if (accountId) where.accountId = accountId;
    if (stage) where.stage = stage;
    if (name) where.name = { contains: name, mode: 'insensitive' };

    const [rows, total] = await Promise.all([
      this.prisma.opportunity.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.opportunity.count({ where }),
    ]);

    const now = new Date();
    const data = rows.map((o) => {
      const daysSinceLastTouch = OpportunityService.daysSince(o.lastActivityAt, now);
      const daysInStage = OpportunityService.daysSince(o.lastStageChangedAt, now);
      const health = computeHealthScore({
        stage: o.stage,
        daysSinceLastTouch,
        daysInStage,
        nextFollowUpAt: o.nextFollowUpAt,
        now,
      });
      return {
        ...o,
        daysSinceLastTouch,
        daysInStage,
        healthScore: health.healthScore,
        healthStatus: health.healthStatus,
        healthSignals: health.healthSignals,
      };
    });

    type WithWorkflow = Opportunity & {
      daysSinceLastTouch: number | null;
      daysInStage: number | null;
      healthScore: number;
      healthStatus: 'healthy' | 'warning' | 'critical';
      healthSignals: Array<{ code: string; severity: string; message: string; penalty: number }>;
    };
    return { data, page, pageSize, total } as PaginatedResult<WithWorkflow>;
  }

  async findOne(id: string): Promise<
    Opportunity & {
      daysSinceLastTouch: number | null;
      daysInStage: number | null;
      healthScore: number;
      healthStatus: 'healthy' | 'warning' | 'critical';
      healthSignals: Array<{ code: string; severity: string; message: string; penalty: number }>;
    }
  > {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id },
      select: {
        id: true,
        accountId: true,
        name: true,
        amount: true,
        stage: true,
        probability: true,
        closeDate: true,
        sourceLeadId: true,
        lastActivityAt: true,
        lastStageChangedAt: true,
        nextFollowUpAt: true,
        healthScore: true,
        healthSignals: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!opportunity) throw new NotFoundException(`Opportunity ${id} not found`);
    const now = new Date();
    const daysSinceLastTouch = OpportunityService.daysSince(opportunity.lastActivityAt, now);
    const daysInStage = OpportunityService.daysSince(opportunity.lastStageChangedAt, now);
    const health = computeHealthScore({
      stage: opportunity.stage,
      daysSinceLastTouch,
      daysInStage,
      nextFollowUpAt: opportunity.nextFollowUpAt,
      now,
    });
    const result = {
      ...opportunity,
      daysSinceLastTouch,
      daysInStage,
      healthScore: health.healthScore,
      healthStatus: health.healthStatus,
      healthSignals: health.healthSignals,
    };
    return result as Opportunity & {
      daysSinceLastTouch: number | null;
      daysInStage: number | null;
      healthScore: number;
      healthStatus: 'healthy' | 'warning' | 'critical';
      healthSignals: Array<{ code: string; severity: string; message: string; penalty: number }>;
    };
  }

  async update(id: string, dto: UpdateOpportunityDto): Promise<Opportunity> {
    const current = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Opportunity ${id} not found`);

    const stageChanged =
      dto.stage !== undefined && dto.stage !== current.stage;
    const now = new Date();

    const updated = await this.prisma.opportunity.update({
      where: { id },
      data: {
        ...dto,
        amount: dto.amount !== undefined ? dto.amount : undefined,
        closeDate: dto.closeDate !== undefined ? (dto.closeDate ? new Date(dto.closeDate) : null) : undefined,
        ...(stageChanged && {
          lastStageChangedAt: now,
        }),
      },
    });

    if (stageChanged) {
      await this.activityService.createRaw({
        entityType: 'opportunity',
        entityId: id,
        type: 'stage_change',
        payload: { from: current.stage ?? null, to: dto.stage },
      });
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.opportunity.delete({ where: { id } });
  }
}
