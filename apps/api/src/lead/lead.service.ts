import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Lead, Prisma } from '@crm/db';
import { PaginatedResult } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

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
    const { page = 1, pageSize = 20, name, status, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: Prisma.LeadWhereInput = {};
    if (name) where.name = { contains: name, mode: 'insensitive' };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
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
}
