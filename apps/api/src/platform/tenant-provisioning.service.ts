import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { TenantStatus } from '@crm/db';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { Role } from '../auth/constants';
import { CreateTenantDto } from './dto/create-tenant.dto';
import {
  getDefaultTenantSettings,
  type TenantSettingsDto,
} from './tenant-provisioning.types';
import type { TenantDetail } from './platform.service';

export interface ProvisionTenantResult {
  tenant: TenantDetail;
  initialAdmin?: { id: string; email: string; role: string };
}

/**
 * Orchestrates full tenant provisioning: tenant record, default settings,
 * default pipeline/activity config, and optional initial admin user.
 * Uses a transaction for tenant + config; creates initial admin after (for email side effect).
 */
@Injectable()
export class TenantProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Provision a new tenant with default settings and optional initial admin.
   * Idempotency: slug must be unique; initial admin is created at most once per request.
   */
  async provision(dto: CreateTenantDto): Promise<ProvisionTenantResult> {
    const slug = dto.slug.toLowerCase().trim();
    const existing = await this.prisma.tenant.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(`Tenant with slug "${dto.slug}" already exists`);
    }

    const settings = this.mergeSettings(dto.settings);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name: dto.name.trim(),
          slug,
          displayName: dto.displayName?.trim() ?? null,
          status: dto.status ?? TenantStatus.ACTIVE,
          logoUrl: dto.logoUrl ?? null,
          faviconUrl: dto.faviconUrl ?? null,
          primaryColor: dto.primaryColor ?? null,
          accentColor: dto.accentColor ?? null,
          themeMode: dto.themeMode ?? null,
          settings: settings as object,
        },
      });
      return created;
    });

    let initialAdminResult: { id: string; email: string; role: string } | undefined;

    if (dto.initialAdmin?.email) {
      const role = dto.initialAdmin.role ?? Role.ADMIN;
      if (role === Role.GLOBAL_ADMIN) {
        throw new BadRequestException('Cannot create GLOBAL_ADMIN for a tenant');
      }
      const created = await this.usersService.create(
        { email: dto.initialAdmin.email.trim(), role },
        tenant.id,
      );
      initialAdminResult = { id: created.id, email: created.email, role: created.role };
    }

    const tenantDetail = await this.getTenantDetail(tenant.id);
    return {
      tenant: tenantDetail,
      ...(initialAdminResult && { initialAdmin: initialAdminResult }),
    };
  }

  /** Merge incoming settings with defaults (incoming overrides). */
  private mergeSettings(incoming?: Record<string, unknown>): TenantSettingsDto {
    const defaults = getDefaultTenantSettings();
    if (!incoming || Object.keys(incoming).length === 0) {
      return defaults;
    }
    return {
      ...defaults,
      ...incoming,
      featureFlags: { ...defaults.featureFlags, ...(incoming.featureFlags as object) },
      defaultPipelineStages: (incoming.defaultPipelineStages as string[]) ?? defaults.defaultPipelineStages,
      defaultActivityTypes: (incoming.defaultActivityTypes as string[]) ?? defaults.defaultActivityTypes,
    };
  }

  private async getTenantDetail(id: string): Promise<TenantDetail> {
    const t = await this.prisma.tenant.findUnique({
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
    if (!t) throw new Error(`Tenant ${id} not found`);
    return t as TenantDetail;
  }
}
