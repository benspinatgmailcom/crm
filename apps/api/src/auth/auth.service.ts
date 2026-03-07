import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { TenantStatus, User } from '@crm/db';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { Role } from './constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { authConfig } from './auth.config';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string | null;
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
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto, requestingAdmin?: User): Promise<AuthTokens & { user: User }> {
    const userCount = await this.prisma.user.count();

    // First user bootstrap: create as ADMIN (tenantId null for platform admin)
    if (userCount === 0) {
      const user = await this.createUser(dto.email, dto.password, Role.ADMIN, null);
      return this.loginUser(user);
    }

    // Otherwise require ADMIN; new user gets same tenant as requesting admin (derived from JWT, not body)
    if (!requestingAdmin || requestingAdmin.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can register new users');
    }
    const tenantId = requestingAdmin.tenantId ?? null;
    const user = await this.createUser(dto.email, dto.password, dto.role ?? Role.USER, tenantId);
    return this.loginUser(user);
  }

  async login(dto: LoginDto): Promise<AuthTokens & { user: User }> {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isActive === false) {
      throw new ForbiddenException('Account is deactivated');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // GLOBAL_ADMIN with tenantId null can always log in. Others must belong to an ACTIVE tenant.
    if (user.tenantId != null) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { status: true },
      });
      if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
        throw new ForbiddenException(
          tenant?.status === TenantStatus.SUSPENDED
            ? 'Tenant is suspended. Contact your administrator.'
            : tenant?.status === TenantStatus.DELETED
              ? 'Tenant is no longer active.'
              : 'Tenant is not active. Contact your administrator.',
        );
      }
    }

    return this.loginUser(user);
  }

  async refresh(
    refreshToken: string,
  ): Promise<AuthTokens & { user: { id: string; email: string; role: string; tenantId: string | null } }> {
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

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, tenantId: true, isActive: true, mustChangePassword: true, createdAt: true, updatedAt: true, passwordHash: true },
    });

    if (user.isActive === false) {
      throw new UnauthorizedException('Account is deactivated');
    }

    if (user.tenantId != null) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { status: true },
      });
      if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
        throw new UnauthorizedException('Tenant is not active');
      }
    }

    const tokens = await this.issueTokens(user as User);
    return {
      ...tokens,
      user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
    };
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

  /** Returns current user and tenant branding for authenticated context. */
  async me(userId: string): Promise<{
    user: Omit<User, 'passwordHash'>;
    tenant: {
      id: string;
      name: string;
      slug: string;
      displayName: string | null;
      logoUrl: string | null;
      faviconUrl: string | null;
      primaryColor: string | null;
      accentColor: string | null;
      themeMode: string | null;
    } | null;
  }> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            displayName: true,
            logoUrl: true,
            faviconUrl: true,
            primaryColor: true,
            accentColor: true,
            themeMode: true,
          },
        },
      },
    });
    if (!row) throw new UnauthorizedException('User not found');
    const { tenant, ...userFields } = row;
    const user = userFields as Omit<User, 'passwordHash'>;
    const tenantBranding = tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          displayName: tenant.displayName,
          logoUrl: tenant.logoUrl,
          faviconUrl: tenant.faviconUrl,
          primaryColor: tenant.primaryColor,
          accentColor: tenant.accentColor,
          themeMode: tenant.themeMode,
        }
      : null;
    return { user, tenant: tenantBranding };
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { email } });
    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    if (user.tenantId == null) return;
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tenantId: user.tenantId, tokenHash, expiresAt },
    });

    try {
      await this.emailService.sendSetPasswordEmail(user.email, rawToken);
    } catch {
      // Do not rethrow: never reveal whether the email exists
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetRecord = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!resetRecord) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash, mustChangePassword: false },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: now },
      }),
    ]);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
      select: { id: true, tenantId: true, email: true, role: true, isActive: true, mustChangePassword: true, createdAt: true, updatedAt: true },
    });
    return updated;
  }

  private async createUser(
    email: string,
    password: string,
    role: Role,
    tenantId: string | null,
  ): Promise<User> {
    const existing = await this.prisma.user.findFirst({
      where: {
        email,
        tenantId: tenantId == null ? { equals: null } : tenantId,
      },
    });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    return this.prisma.user.create({
      data: { email, passwordHash, role, ...(tenantId != null && { tenantId }) },
    });
  }

  private async loginUser(user: User): Promise<AuthTokens & { user: User }> {
    const tokens = await this.issueTokens(user);
    const tokenHash = this.hashToken(tokens.refreshToken);
    const expiresAt = new Date(Date.now() + this.parseTtl(this.jwtConfig.refreshTtl) * 1000);

    if (user.tenantId != null) {
      await this.prisma.refreshToken.create({
        data: { tenantId: user.tenantId, userId: user.id, tokenHash, expiresAt },
      });
    }

    return { ...tokens, user };
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const payload: Omit<JwtPayload, 'type'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ?? null,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, type: 'access' },
        { secret: this.jwtConfig.accessSecret, expiresIn: this.jwtConfig.accessTtl },
      ),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        { secret: this.jwtConfig.refreshSecret, expiresIn: this.jwtConfig.refreshTtl },
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
    if (!user || user.isActive === false) return null;
    return user;
  }
}
