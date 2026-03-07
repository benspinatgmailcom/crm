import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@crm/db';
import { PrismaService } from '../prisma/prisma.service';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PaginatedResult } from '../common/pagination.dto';

export interface TaskListItem {
  id: string;
  entityType: string;
  entityId: string;
  type: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  dueAt: string | null;
  status: string;
  priority: string | null;
  ownerId: string | null;
  ownerEmail: string | null;
  entityName?: string;
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: QueryTasksDto,
    currentUserId: string,
    isAdmin: boolean,
    tenantId: string,
  ): Promise<PaginatedResult<TaskListItem>> {
    const { page = 1, pageSize = 20, assignee = 'me', status = 'open', overdue, dueToday, dueThisWeek } = query;

    const where: Prisma.ActivityWhereInput = { tenantId, type: 'task', deletedAt: null };

    if (assignee === 'me') {
      const myOppIds = await this.prisma.opportunity.findMany({
        where: { tenantId, ownerId: currentUserId },
        select: { id: true },
      }).then((r) => r.map((o) => o.id));
      where.OR = [{ entityType: 'opportunity', entityId: { in: myOppIds } }];
    } else if (assignee === 'all') {
      // no owner filter (still tenant-scoped via where.tenantId)
    } else if (isAdmin && assignee) {
      const oppIds = await this.prisma.opportunity.findMany({
        where: { tenantId, ownerId: assignee },
        select: { id: true },
      }).then((r) => r.map((o) => o.id));
      where.OR = [{ entityType: 'opportunity', entityId: { in: oppIds } }];
    } else {
      const myOppIds = await this.prisma.opportunity.findMany({
        where: { tenantId, ownerId: currentUserId },
        select: { id: true },
      }).then((r) => r.map((o) => o.id));
      where.OR = [{ entityType: 'opportunity', entityId: { in: myOppIds } }];
    }

    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 2000,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          type: true,
          payload: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    let items: TaskListItem[] = activities.map((a) => {
      const p = (a.payload as Record<string, unknown>) || {};
      const dueAtRaw = p.dueAt;
      const dueAt = dueAtRaw != null ? String(dueAtRaw) : null;
      const statusVal = p.status != null ? String(p.status) : 'open';
      return {
        id: a.id,
        entityType: a.entityType,
        entityId: a.entityId,
        type: a.type,
        payload: p,
        metadata: (a.metadata as Record<string, unknown>) || null,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        title: String(p.title ?? ''),
        dueAt,
        status: statusVal,
        priority: p.priority != null ? String(p.priority) : null,
        ownerId: null,
        ownerEmail: null,
      };
    });

    if (activities.length > 0) {
      const oppIds = [...new Set(activities.filter((a) => a.entityType === 'opportunity').map((a) => a.entityId))];
      const opportunities = await this.prisma.opportunity.findMany({
        where: { tenantId, id: { in: oppIds } },
        select: { id: true, accountId: true, ownerId: true, name: true, owner: { select: { email: true } } },
      });
      const oppMap = new Map(opportunities.map((o) => [o.id, o]));
      items = items.map((item) => {
        if (item.entityType === 'opportunity') {
          const opp = oppMap.get(item.entityId);
          if (opp) {
            item.ownerId = opp.ownerId;
            item.ownerEmail = opp.owner?.email ?? null;
            item.entityName = opp.name;
          }
        }
        return item;
      });

      // Resolve entity names for lead, account, contact
      const leadIds = [...new Set(activities.filter((a) => a.entityType === 'lead').map((a) => a.entityId))];
      const accountIds = [...new Set(activities.filter((a) => a.entityType === 'account').map((a) => a.entityId))];
      const contactIds = [...new Set(activities.filter((a) => a.entityType === 'contact').map((a) => a.entityId))];

      const [leads, accounts, contacts] = await Promise.all([
        leadIds.length > 0
          ? this.prisma.lead.findMany({ where: { tenantId, id: { in: leadIds } }, select: { id: true, name: true } })
          : [],
        accountIds.length > 0
          ? this.prisma.account.findMany({ where: { tenantId, id: { in: accountIds } }, select: { id: true, name: true } })
          : [],
        contactIds.length > 0
          ? this.prisma.contact.findMany({
              where: { tenantId, id: { in: contactIds } },
              select: { id: true, firstName: true, lastName: true },
            })
          : [],
      ]);

      const leadMap = new Map(leads.map((l) => [l.id, l.name]));
      const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
      const contactMap = new Map(contacts.map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim()]));

      items = items.map((item) => {
        if (item.entityType === 'lead') item.entityName = leadMap.get(item.entityId) ?? undefined;
        if (item.entityType === 'account') item.entityName = accountMap.get(item.entityId) ?? undefined;
        if (item.entityType === 'contact') item.entityName = contactMap.get(item.entityId) ?? undefined;
        return item;
      });

      // Deduplicate: when the same task exists on both an account and an opportunity of that account
      // (e.g. seed data), show only the opportunity row (assignee + entity name).
      const coveredByOpportunity = new Set<string>();
      for (const item of items) {
        if (item.entityType === 'opportunity') {
          const opp = oppMap.get(item.entityId);
          if (opp?.accountId) {
            coveredByOpportunity.add(`${opp.accountId}\t${item.title}\t${item.dueAt ?? ''}`);
          }
        }
      }
      items = items.filter(
        (item) =>
          item.entityType !== 'account' ||
          !coveredByOpportunity.has(`${item.entityId}\t${item.title}\t${item.dueAt ?? ''}`),
      );
    }

    items = items.filter((item) => {
      if (status === 'done' && item.status !== 'done') return false;
      if (status === 'open' && item.status === 'done') return false;
      if (overdue) {
        if (!item.dueAt) return false;
        const d = new Date(item.dueAt);
        if (d >= todayStart) return false;
      }
      if (dueToday) {
        if (!item.dueAt) return false;
        const d = new Date(item.dueAt);
        if (d < todayStart || d > todayEnd) return false;
      }
      if (dueThisWeek) {
        if (!item.dueAt) return false;
        const d = new Date(item.dueAt);
        if (d < todayStart || d > weekEnd) return false;
      }
      return true;
    });

    items.sort((a, b) => {
      const da = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    });

    const totalFiltered = items.length;
    const start = (page - 1) * pageSize;
    const paginated = items.slice(start, start + pageSize);

    return {
      data: paginated,
      page,
      pageSize,
      total: totalFiltered,
    };
  }

  async update(id: string, dto: UpdateTaskDto, tenantId: string): Promise<TaskListItem> {
    const activity = await this.prisma.activity.findFirst({
      where: { id, tenantId, type: 'task', deletedAt: null },
      select: { id: true, entityType: true, entityId: true, type: true, payload: true, metadata: true, createdAt: true, updatedAt: true },
    });
    if (!activity) throw new NotFoundException(`Task ${id} not found`);

    const payload = (activity.payload as Record<string, unknown>) || {};
    if (dto.title !== undefined) payload.title = dto.title;
    if (dto.dueAt !== undefined) payload.dueAt = dto.dueAt || null;
    if (dto.status !== undefined) payload.status = dto.status;
    if (dto.priority !== undefined) payload.priority = dto.priority || null;

    const updated = await this.prisma.activity.update({
      where: { id },
      data: { payload: payload as Prisma.InputJsonValue },
      select: { id: true, entityType: true, entityId: true, type: true, payload: true, metadata: true, createdAt: true, updatedAt: true },
    });

    const p = (updated.payload as Record<string, unknown>) || {};
    return {
      id: updated.id,
      entityType: updated.entityType,
      entityId: updated.entityId,
      type: updated.type,
      payload: p,
      metadata: (updated.metadata as Record<string, unknown>) || null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      title: String(p.title ?? ''),
      dueAt: p.dueAt != null ? String(p.dueAt) : null,
      status: String(p.status ?? 'open'),
      priority: p.priority != null ? String(p.priority) : null,
      ownerId: null,
      ownerEmail: null,
    };
  }
}
