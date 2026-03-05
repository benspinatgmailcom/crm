import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Opportunity, Prisma, User } from '@crm/db';
import { PaginatedResult } from '../common/pagination.dto';
import { ActivityService } from '../activity/activity.service';
import { OpportunityForecastService } from '../forecast-engine/opportunity-forecast.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../auth/constants';
import { evaluateForecast } from '../forecast-engine/forecast-engine.evaluate';
import { computeHealthScore } from './health-scoring';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { QueryOpportunityDto } from './dto/query-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

@Injectable()
export class OpportunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
    private readonly forecastService: OpportunityForecastService,
  ) {}

  async create(dto: CreateOpportunityDto, currentUser: User): Promise<Opportunity> {
    const account = await this.prisma.account.findUnique({ where: { id: dto.accountId } });
    if (!account) throw new NotFoundException(`Account ${dto.accountId} not found`);

    const isAdmin = currentUser.role === Role.ADMIN;
    const ownerId = dto.ownerId ?? currentUser.id;
    if (!isAdmin && dto.ownerId != null && dto.ownerId !== currentUser.id) {
      throw new ForbiddenException('Only admins can set opportunity owner to another user');
    }

    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, isActive: true },
    });
    if (!owner) throw new NotFoundException(`User ${ownerId} not found`);
    if (!owner.isActive) throw new BadRequestException('Cannot assign opportunity to an inactive user');

    const created = await this.prisma.opportunity.create({
      data: {
        accountId: dto.accountId,
        name: dto.name,
        amount: dto.amount != null ? dto.amount : undefined,
        stage: dto.stage ?? 'prospecting',
        probability: dto.probability,
        closeDate: dto.closeDate ? new Date(dto.closeDate) : undefined,
        ownerId,
      },
    });
    await this.forecastService.recomputeForecast(created.id).catch(() => {
      /* non-fatal; values can be backfilled */
    });
    return created;
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

  async getPipeline(
    currentUser: User,
    ownerFilter?: string,
    forecastCategory?: string,
  ): Promise<Record<string, Array<{
    id: string;
    name: string;
    amount: { toString(): string } | null;
    closeDate: Date | null;
    stage: string | null;
    accountId: string;
    accountName: string;
    ownerId: string;
    ownerEmail: string;
    daysSinceLastTouch: number | null;
    daysInStage: number | null;
    healthScore: number;
    healthStatus: 'healthy' | 'warning' | 'critical';
    healthSignals: Array<{ code: string; severity: string; message: string; penalty: number }>;
    winProbability: number;
    forecastCategory: string;
    expectedRevenue: number | null;
  }>>> {
    const isAdmin = currentUser.role === Role.ADMIN;
    const ownerWhere: Prisma.OpportunityWhereInput = {};
    const raw = ownerFilter?.toLowerCase();
    if (raw === 'me' || (!raw && !isAdmin)) {
      ownerWhere.ownerId = currentUser.id;
    } else if (raw === 'all' && isAdmin) {
      // no filter
    } else if (raw && raw !== 'all') {
      if (raw !== currentUser.id && !isAdmin) {
        throw new ForbiddenException('Only admins can filter pipeline by another user');
      }
      ownerWhere.ownerId = raw;
    }

    const where: Prisma.OpportunityWhereInput = { ...ownerWhere };
    if (forecastCategory?.trim()) {
      where.forecastCategory = forecastCategory.trim();
    }

    const opportunities = await this.prisma.opportunity.findMany({
      where,
      select: {
        id: true,
        name: true,
        amount: true,
        closeDate: true,
        stage: true,
        accountId: true,
        ownerId: true,
        lastActivityAt: true,
        lastStageChangedAt: true,
        nextFollowUpAt: true,
        account: { select: { name: true } },
        owner: { select: { email: true } },
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
      ownerId: string;
      ownerEmail: string;
      daysSinceLastTouch: number | null;
      daysInStage: number | null;
      healthScore: number;
      healthStatus: 'healthy' | 'warning' | 'critical';
      healthSignals: Array<{ code: string; severity: string; message: string; penalty: number }>;
      winProbability: number;
      forecastCategory: string;
      expectedRevenue: number | null;
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
      const amountNum = o.amount != null ? Number(o.amount.toString()) : null;
      const forecast = evaluateForecast(
        {
          stage: o.stage ?? 'prospecting',
          amount: amountNum,
          closeDate: o.closeDate,
          daysSinceLastTouch,
          daysInStage,
          healthScore: health.healthScore,
          healthStatus: health.healthStatus,
          healthSignals: health.healthSignals,
          nextFollowUpAt: o.nextFollowUpAt,
        },
        now,
      );
      const entry = {
        id: o.id,
        name: o.name,
        amount: o.amount,
        closeDate: o.closeDate,
        stage: o.stage,
        accountId: o.accountId,
        accountName: o.account.name,
        ownerId: o.ownerId,
        ownerEmail: o.owner.email,
        daysSinceLastTouch,
        daysInStage,
        healthScore: health.healthScore,
        healthStatus: health.healthStatus,
        healthSignals: health.healthSignals,
        winProbability: forecast.winProbability,
        forecastCategory: forecast.forecastCategory,
        expectedRevenue: forecast.expectedRevenue,
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
      winProbability: number | null;
      forecastCategory: string | null;
      expectedRevenue: { toString(): string } | null;
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
        ownerId: true,
        lastActivityAt: true,
        lastStageChangedAt: true,
        nextFollowUpAt: true,
        healthScore: true,
        healthSignals: true,
        winProbability: true,
        forecastCategory: true,
        expectedRevenue: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, email: true } },
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
    return result as unknown as Opportunity & {
      daysSinceLastTouch: number | null;
      daysInStage: number | null;
      healthScore: number;
      healthStatus: 'healthy' | 'warning' | 'critical';
      healthSignals: Array<{ code: string; severity: string; message: string; penalty: number }>;
      winProbability: number | null;
      forecastCategory: string | null;
      expectedRevenue: { toString(): string } | null;
    };
  }

  async update(id: string, dto: UpdateOpportunityDto, currentUser: User): Promise<Opportunity> {
    const current = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Opportunity ${id} not found`);

    const isAdmin = currentUser.role === Role.ADMIN;
    const isOwner = current.ownerId === currentUser.id;

    if (dto.ownerId !== undefined) {
      if (!isAdmin && !isOwner) {
        throw new ForbiddenException('Only the owner or an admin can reassign this opportunity');
      }
      if (!isAdmin && dto.ownerId !== currentUser.id) {
        throw new ForbiddenException('Only admins can assign an opportunity to another user');
      }
      const newOwner = await this.prisma.user.findUnique({
        where: { id: dto.ownerId },
        select: { id: true, isActive: true },
      });
      if (!newOwner) throw new NotFoundException(`User ${dto.ownerId} not found`);
      if (!newOwner.isActive) throw new BadRequestException('Cannot assign opportunity to an inactive user');
    }

    const stageChanged =
      dto.stage !== undefined && dto.stage !== current.stage;
    const now = new Date();

    const { ownerId, winProbability: dtoWinProb, forecastCategory: dtoCategory, ...restDto } = dto;
    const updateData: Prisma.OpportunityUpdateInput = {
      ...restDto,
      amount: dto.amount !== undefined ? dto.amount : undefined,
      closeDate: dto.closeDate !== undefined ? (dto.closeDate ? new Date(dto.closeDate) : null) : undefined,
      ...(stageChanged && {
        lastStageChangedAt: now,
      }),
    };
    if (ownerId !== undefined) updateData.owner = { connect: { id: ownerId } };

    if (dtoWinProb !== undefined) {
      updateData.winProbability = dtoWinProb;
      const amountRaw = dto.amount !== undefined ? dto.amount : current.amount;
      const amountNum = amountRaw != null ? Number(amountRaw.toString()) : null;
      updateData.expectedRevenue = amountNum != null ? amountNum * (dtoWinProb / 100) : null;
    }
    if (dtoCategory !== undefined) {
      updateData.forecastCategory = dtoCategory;
    }

    const updated = await this.prisma.opportunity.update({
      where: { id },
      data: updateData,
    });

    if (stageChanged) {
      await this.activityService.createRaw({
        entityType: 'opportunity',
        entityId: id,
        type: 'stage_change',
        payload: { from: current.stage ?? null, to: dto.stage },
      });
    }

    const userOverrodeForecast = dtoWinProb !== undefined || dtoCategory !== undefined;
    if (!userOverrodeForecast) {
      await this.forecastService.recomputeForecast(id).catch(() => {
        /* non-fatal; values can be backfilled */
      });
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.opportunity.delete({ where: { id } });
  }
}
