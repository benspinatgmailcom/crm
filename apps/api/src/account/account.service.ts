import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Account, Prisma } from '@crm/db';
import { PaginatedResult } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { QueryAccountDto } from './dto/query-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAccountDto, tenantId: string): Promise<Account> {
    try {
      return await this.prisma.account.create({
        data: {
          tenantId,
          name: dto.name,
          industry: dto.industry,
          website: dto.website,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Account with this name may already exist');
      }
      throw e;
    }
  }

  async findAll(query: QueryAccountDto, tenantId: string): Promise<PaginatedResult<Account>> {
    const { page = 1, pageSize = 20, name, industry, sortBy = 'createdAt', sortDir = 'desc' } = query;

    const where: Prisma.AccountWhereInput = { tenantId };
    if (name) where.name = { contains: name, mode: 'insensitive' };
    if (industry) where.industry = { contains: industry, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.account.count({ where }),
    ]);

    return { data, page, pageSize, total };
  }

  async findOne(id: string, tenantId: string): Promise<Account> {
    const account = await this.prisma.account.findFirst({ where: { id, tenantId } });
    if (!account) throw new NotFoundException(`Account ${id} not found`);
    return account;
  }

  async update(id: string, dto: UpdateAccountDto, tenantId: string): Promise<Account> {
    await this.findOne(id, tenantId);
    try {
      return await this.prisma.account.update({
        where: { id },
        data: dto,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Account with this name may already exist');
      }
      throw e;
    }
  }

  async remove(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.prisma.account.delete({ where: { id } });
  }
}
