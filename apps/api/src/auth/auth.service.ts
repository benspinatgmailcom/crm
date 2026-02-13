import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '@crm/db';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from './constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { authConfig } from './auth.config';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly jwtConfig = authConfig().jwt;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto, requestingAdmin?: User): Promise<AuthTokens & { user: User }> {
    const userCount = await this.prisma.user.count();

    // First user bootstrap: create as ADMIN
    if (userCount === 0) {
      const user = await this.createUser(dto.email, dto.password, Role.ADMIN);
      return this.loginUser(user);
    }

    // Otherwise require ADMIN
    if (!requestingAdmin || requestingAdmin.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can register new users');
    }

    const user = await this.createUser(dto.email, dto.password, dto.role ?? Role.USER);
    return this.loginUser(user);
  }

  async login(dto: LoginDto): Promise<AuthTokens & { user: User }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.loginUser(user);
  }

  async refresh(
    refreshToken: string,
  ): Promise<AuthTokens & { user: { id: string; email: string; role: string } }> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke old token (optional: allow multiple refresh tokens)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, createdAt: true, updatedAt: true },
    });

    const tokens = await this.issueTokens(user as User);
    return { ...tokens, user };
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken).catch(() => null);
    if (!payload) return;

    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId: payload.sub, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, createdAt: true, updatedAt: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  private async createUser(email: string, password: string, role: Role): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    return this.prisma.user.create({
      data: { email, passwordHash, role },
    });
  }

  private async loginUser(user: User): Promise<AuthTokens & { user: User }> {
    const tokens = await this.issueTokens(user);
    const tokenHash = this.hashToken(tokens.refreshToken);
    const expiresAt = new Date(Date.now() + this.parseTtl(this.jwtConfig.refreshTtl) * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const { passwordHash: _, ...safeUser } = user;
    return {
      ...tokens,
      user: user,
    };
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const payload: Omit<JwtPayload, 'type'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, type: 'access' },
        {
          secret: this.jwtConfig.accessSecret,
          expiresIn: this.jwtConfig.accessTtl,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        {
          secret: this.jwtConfig.refreshSecret,
          expiresIn: this.jwtConfig.refreshTtl,
        },
      ),
    ]);

    const expiresIn = this.parseTtl(this.jwtConfig.accessTtl);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  private verifyRefreshToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.jwtConfig.refreshSecret,
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseTtl(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // 15 min default
    const [, num, unit] = match;
    const n = parseInt(num!, 10);
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return n * (multipliers[unit] ?? 60);
  }

  async validateUser(payload: JwtPayload): Promise<User | null> {
    if (payload.type !== 'access') return null;
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    return user ?? null;
  }
}
