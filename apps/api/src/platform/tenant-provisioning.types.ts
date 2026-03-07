/**
 * Re-export tenant defaults from shared for use in provisioning.
 * Tenant.settings JSON shape and merge logic live here; defaults come from @crm/shared.
 */
import {
  getDefaultTenantSettings as getDefaults,
  type TenantSettingsDto,
} from '@crm/shared';

export type { TenantSettingsDto };
export const getDefaultTenantSettings = getDefaults;
