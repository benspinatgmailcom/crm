/**
 * Default tenant settings for provisioning and seed.
 * Used by API TenantProvisioningService and optionally by db seed.
 */

export interface TenantSettingsDto {
  defaultCurrency?: string;
  dateFormat?: string;
  locale?: string;
  featureFlags?: Record<string, boolean>;
  defaultPipelineStages?: string[];
  defaultActivityTypes?: string[];
  dashboard?: Record<string, unknown>;
  branding?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Default pipeline stages (must match opportunity pipeline slugs). */
export const DEFAULT_PIPELINE_STAGES = [
  'prospecting',
  'qualification',
  'discovery',
  'proposal',
  'negotiation',
  'closed-won',
  'closed-lost',
] as const;

/** Default activity type slugs. */
export const DEFAULT_ACTIVITY_TYPES = [
  'call',
  'email',
  'meeting',
  'note',
  'task',
  'follow-up',
  'stage_change',
  'ai_summary',
  'ai_draft',
  'ai_next_action',
] as const;

export function getDefaultTenantSettings(): TenantSettingsDto {
  return {
    defaultCurrency: 'USD',
    dateFormat: 'MM/dd/yyyy',
    locale: 'en-US',
    featureFlags: {},
    defaultPipelineStages: [...DEFAULT_PIPELINE_STAGES],
    defaultActivityTypes: [...DEFAULT_ACTIVITY_TYPES],
    dashboard: {},
    branding: {},
  };
}
