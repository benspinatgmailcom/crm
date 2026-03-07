import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantStatus } from '@crm/db';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../constants';

/** Rejects requests when the authenticated user belongs to a tenant that is not ACTIVE. */
@Injectable()
export class TenantStatusGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ user?: { tenantId?: string | null } }>();
    const user = request.user;
    if (!user || user.tenantId == null) return true;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { status: true },
    });
    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
      throw new ForbiddenException(
        tenant?.status === TenantStatus.SUSPENDED
          ? 'Tenant is suspended. Contact your administrator.'
          : 'Tenant is not active.',
      );
    }
    return true;
  }
}
