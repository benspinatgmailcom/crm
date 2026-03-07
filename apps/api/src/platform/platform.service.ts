import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TenantStatus } from '@crm/db';
import { Role } from '../auth/constants';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TenantProvisioningService, type ProvisionTenantResult } from './tenant-provisioning.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';

export type { ProvisionTenantResult };

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  displayName: string | null;
  status: TenantStatus;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  themeMode: string | null;
  createdAt: Date;
}

export interface TenantDetail extends TenantListItem {
  faviconUrl: string | null;
  settings: unknown;
  updatedAt: Date;
}

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly tenantProvisioningService: TenantProvisioningService,
  ) {}

  async listTenants(): Promise<TenantListItem[]> {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        displayName: true,
        status: true,
        logoUrl: true,
        primaryColor: true,
        accentColor: true,
        themeMode: true,
        createdAt: true,
      },
    });
    // Ensure branding fields are always present in JSON (null if not set); avoids blank cells in UI
    return tenants.map((t) => ({
      ...t,
      primaryColor: t.primaryColor ?? null,
      accentColor: t.accentColor ?? null,
    }));
  }

  async getTenant(id: string): Promise<TenantDetail> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        displayName: true,
        status: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        accentColor: true,
        themeMode: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }
    return tenant as TenantDetail;
  }

  async createTenant(dto: CreateTenantDto): Promise<ProvisionTenantResult> {
    return this.tenantProvisioningService.provision(dto);
  }

  async updateTenant(id: string, dto: UpdateTenantDto): Promise<TenantDetail> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }

    if (dto.slug != null && dto.slug.toLowerCase() !== tenant.slug) {
      const existing = await this.prisma.tenant.findUnique({
        where: { slug: dto.slug.toLowerCase() },
      });
      if (existing) {
        throw new ConflictException(`Tenant with slug "${dto.slug}" already exists`);
      }
    }

    await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.slug != null && { slug: dto.slug.toLowerCase() }),
        ...(dto.displayName !== undefined && { displayName: dto.displayName ?? null }),
        ...(dto.status != null && { status: dto.status }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl ?? null }),
        ...(dto.faviconUrl !== undefined && { faviconUrl: dto.faviconUrl ?? null }),
        ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor ?? null }),
        ...(dto.accentColor !== undefined && { accentColor: dto.accentColor ?? null }),
        ...(dto.themeMode !== undefined && { themeMode: dto.themeMode ?? null }),
        ...(dto.settings !== undefined && { settings: (dto.settings ?? undefined) as Prisma.InputJsonValue }),
      },
    });
    return this.getTenant(id);
  }

  async setTenantStatus(id: string, status: TenantStatus): Promise<TenantDetail> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }
    await this.prisma.tenant.update({
      where: { id },
      data: { status },
    });
    return this.getTenant(id);
  }

  async createTenantAdmin(
    tenantId: string,
    dto: CreateTenantAdminDto,
  ): Promise<{ id: string; email: string; role: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }
    const role = dto.role ?? Role.ADMIN;
    if (role === Role.GLOBAL_ADMIN) {
      throw new BadRequestException('Cannot create GLOBAL_ADMIN for a tenant');
    }

    const result = await this.usersService.create(
      { email: dto.email, role },
      tenantId,
    );
    return { id: result.id, email: result.email, role: result.role };
  }
}
