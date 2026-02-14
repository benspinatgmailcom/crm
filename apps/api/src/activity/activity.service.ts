import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Activity, Prisma } from '@crm/db';
import { PaginatedResult } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { PAYLOAD_DTO_MAP } from './dto/payload-dtos';
import { QueryActivityDto } from './dto/query-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateActivityDto): Promise<Activity> {
    const PayloadDto = PAYLOAD_DTO_MAP[dto.type];
    if (PayloadDto) {
      const payloadObj = (dto.payload ?? {}) as Record<string, unknown>;
      const instance = plainToInstance(PayloadDto, payloadObj);
      const errors = await validate(instance, { whitelist: true });
      if (errors.length > 0) {
        const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
        throw new BadRequestException({ message: 'Payload validation failed', errors: messages });
      }
    }

    return await this.prisma.activity.create({
      data: {
        entityType: dto.entityType,
        entityId: dto.entityId,
        type: dto.type,
        payload: (dto.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  /** Create activity without payload validation (e.g. for AI-generated ai_summary) */
  async createRaw(data: {
    entityType: string;
    entityId: string;
    type: string;
    payload: Record<string, unknown>;
  }): Promise<Activity> {
    return await this.prisma.activity.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        type: data.type,
        payload: data.payload as Prisma.InputJsonValue,
      },
    });
  }

  async findAll(query: QueryActivityDto): Promise<PaginatedResult<Activity>> {
    const { page = 1, pageSize = 20, entityType, entityId, type, sortBy = 'createdAt', sortDir = 'desc' } = query;

    const where: Prisma.ActivityWhereInput = { deletedAt: null };
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (type) {
      const types = type.split(',').map((t) => t.trim()).filter(Boolean);
      if (types.length === 1) {
        where.type = types[0];
      } else if (types.length > 1) {
        where.type = { in: types };
      }
    }

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
    const activity = await this.prisma.activity.findFirst({
      where: { id, deletedAt: null },
    });
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
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException(`Activity ${id} not found`);
    await this.prisma.activity.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
