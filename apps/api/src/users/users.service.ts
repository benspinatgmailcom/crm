import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
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
  tempPassword?: string;
}

export interface ResetPasswordResult {
  tempPassword: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

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

    const passwordHash = await bcrypt.hash(
      crypto.randomBytes(32).toString('hex'),
      12,
    );

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role,
        isActive: true,
        mustChangePassword: true,
      },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    try {
      await this.emailService.sendSetPasswordEmail(user.email, rawToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      console.error('[UsersService.create] Set-password email failed for', user.email, msg);
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
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

  async resetPassword(id: string, _dto: ResetPasswordDto): Promise<ResetPasswordResult> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    try {
      await this.emailService.sendSetPasswordEmail(user.email, rawToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send email';
      console.error('[UsersService.resetPassword] Email failed:', message);
      throw new BadRequestException(message);
    }

    return { tempPassword: '' };
  }
}
