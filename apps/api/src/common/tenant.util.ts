import { ForbiddenException } from '@nestjs/common';

/**
 * Returns the current user's tenantId for tenant-scoped operations.
 * Throws ForbiddenException if user has no tenant (e.g. global admin) when tenant context is required.
 * Use for: accounts, contacts, leads, opportunities, activities, attachments.
 */
export function requireTenantId(user: { tenantId: string | null }): string {
  if (user.tenantId == null) {
    throw new ForbiddenException('Tenant context required');
  }
  return user.tenantId;
}
