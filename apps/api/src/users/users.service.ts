import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../auth/constants';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

export interface UserListItem {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date | null;
}

export interface CreateUserResult {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  tempPassword: string;
}

export interface ResetPasswordResult {
  tempPassword: string;
}

function randomPassword(length = 12): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i]! % chars.length];
  }
  return result;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<UserListItem[]> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const lastLogins = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const lastByUser = new Map<string, Date>();
    for (const t of lastLogins) {
      if (!lastByUser.has(t.userId)) {
        lastByUser.set(t.userId, t.createdAt);
      }
    }
    return users.map((u) => ({
      ...u,
      lastLoginAt: lastByUser.get(u.id) ?? null,
    }));
  }

  async create(dto: CreateUserDto): Promise<CreateUserResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const tempPassword = dto.tempPassword ?? randomPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role,
        isActive: true,
        mustChangePassword: true,
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      tempPassword,
    };
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserListItem> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role != null && { role: dto.role }),
        ...(dto.isActive != null && { isActive: dto.isActive }),
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return { ...updated, lastLoginAt: null };
  }

  async resetPassword(id: string, dto: ResetPasswordDto): Promise<ResetPasswordResult> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const tempPassword = dto.tempPassword ?? randomPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });

    return { tempPassword };
  }
}
