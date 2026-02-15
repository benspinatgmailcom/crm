import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Lead, Prisma } from '@crm/db';
import { PaginatedResult } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

export interface ConvertLeadResult {
  leadId: string;
  accountId: string;
  contactId: string;
  opportunityId: string;
  initialTaskActivityId: string;
}

function parseName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: 'Unknown', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

@Injectable()
export class LeadService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLeadDto): Promise<Lead> {
    try {
      return await this.prisma.lead.create({
        data: {
          name: dto.name,
          email: dto.email,
          company: dto.company,
          status: dto.status ?? 'new',
          source: dto.source,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Lead with this email may already exist');
      }
      throw e;
    }
  }

  async findAll(query: QueryLeadDto): Promise<PaginatedResult<Lead>> {
    const { page = 1, pageSize = 20, status, q, sortBy = 'createdAt', sortDir = 'desc' } = query;

    const where: Prisma.LeadWhereInput = {};
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { company: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { data, page, pageSize, total };
  }

  async findOne(id: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto): Promise<Lead> {
    await this.findOne(id);
    try {
      return await this.prisma.lead.update({
        where: { id },
        data: dto,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Lead with this email may already exist');
      }
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.lead.delete({ where: { id } });
  }

  async convert(id: string, dto?: ConvertLeadDto): Promise<ConvertLeadResult> {
    const lead = await this.findOne(id);
    if (lead.convertedAt) {
      throw new BadRequestException('Lead has already been converted');
    }

    const accountName = dto?.accountName ?? lead.company ?? lead.name;
    const opportunityName =
      dto?.opportunityName ?? (lead.company ? `${lead.company} - New opportunity` : `Opportunity from ${lead.name}`);
    const { firstName, lastName } = parseName(lead.name);
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 3);

    const result = await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          name: accountName,
          sourceLeadId: lead.id,
        },
      });

      const contact = await tx.contact.create({
        data: {
          accountId: account.id,
          firstName,
          lastName,
          email: lead.email,
          sourceLeadId: lead.id,
        },
      });

      const opportunity = await tx.opportunity.create({
        data: {
          accountId: account.id,
          name: opportunityName,
          stage: 'prospecting',
          sourceLeadId: lead.id,
        },
      });

      const taskPayload = {
        title: 'Schedule discovery call',
        status: 'open',
        dueAt: dueAt.toISOString(),
        source: { leadConversion: true, leadId: lead.id },
      };

      const initialTask = await tx.activity.create({
        data: {
          entityType: 'opportunity',
          entityId: opportunity.id,
          type: 'task',
          payload: taskPayload as Prisma.InputJsonValue,
        },
      });

      await tx.activity.create({
        data: {
          entityType: 'lead',
          entityId: lead.id,
          type: 'task',
          payload: taskPayload as Prisma.InputJsonValue,
        },
      });

      await tx.activity.create({
        data: {
          entityType: 'lead',
          entityId: lead.id,
          type: 'lead_converted',
          payload: {
            leadId: lead.id,
            accountId: account.id,
            contactId: contact.id,
            opportunityId: opportunity.id,
            initialTaskActivityId: initialTask.id,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.lead.update({
        where: { id: lead.id },
        data: {
          convertedAccountId: account.id,
          convertedContactId: contact.id,
          convertedOpportunityId: opportunity.id,
          convertedAt: new Date(),
          status: 'converted',
        },
      });

      return {
        leadId: lead.id,
        accountId: account.id,
        contactId: contact.id,
        opportunityId: opportunity.id,
        initialTaskActivityId: initialTask.id,
      };
    });

    return result;
  }
}
