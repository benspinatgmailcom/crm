import { Injectable, NotFoundException } from '@nestjs/common';
import { Activity, Prisma } from '@crm/db';
import { PaginatedResult } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { QueryActivityDto } from './dto/query-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateActivityDto): Promise<Activity> {
    return await this.prisma.activity.create({
      data: {
        entityType: dto.entityType,
        entityId: dto.entityId,
        type: dto.type,
        payload: (dto.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async findAll(query: QueryActivityDto): Promise<PaginatedResult<Activity>> {
    const { page = 1, pageSize = 20, entityType, entityId, type, sortBy = 'createdAt', sortDir = 'desc' } = query;

    const where: Prisma.ActivityWhereInput = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.activity.count({ where }),
    ]);

    return { data, page, pageSize, total };
  }

  async findOne(id: string): Promise<Activity> {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException(`Activity ${id} not found`);
    return activity;
  }

  async update(id: string, dto: UpdateActivityDto): Promise<Activity> {
    await this.findOne(id);
    return await this.prisma.activity.update({
      where: { id },
      data: {
        ...(dto.type != null && { type: dto.type }),
        ...(dto.payload != null && { payload: dto.payload as Prisma.InputJsonValue }),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.activity.delete({ where: { id } });
  }
}
