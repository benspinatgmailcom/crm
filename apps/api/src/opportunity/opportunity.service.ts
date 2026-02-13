import { Injectable, NotFoundException } from '@nestjs/common';
import { Opportunity, Prisma } from '@crm/db';
import { PaginatedResult } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { QueryOpportunityDto } from './dto/query-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

@Injectable()
export class OpportunityService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findAll(query: QueryOpportunityDto): Promise<PaginatedResult<Opportunity>> {
    const { page = 1, pageSize = 20, name, accountId, stage, sortBy = 'createdAt', sortDir = 'desc' } = query;

    const where: Prisma.OpportunityWhereInput = {};
    if (accountId) where.accountId = accountId;
    if (stage) where.stage = stage;
    if (name) where.name = { contains: name, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.opportunity.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.opportunity.count({ where }),
    ]);

    return { data, page, pageSize, total };
  }

  async findOne(id: string): Promise<Opportunity> {
    const opportunity = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!opportunity) throw new NotFoundException(`Opportunity ${id} not found`);
    return opportunity;
  }

  async update(id: string, dto: UpdateOpportunityDto): Promise<Opportunity> {
    await this.findOne(id);
    return await this.prisma.opportunity.update({
      where: { id },
      data: {
        ...dto,
        amount: dto.amount != null ? dto.amount : undefined,
        closeDate: dto.closeDate ? new Date(dto.closeDate) : undefined,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.opportunity.delete({ where: { id } });
  }
}
