/** Shared types for platform admin UI (matches API responses). */

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  displayName: string | null;
  status: string;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  themeMode: string | null;
  createdAt: string;
}

export interface TenantDetail extends TenantListItem {
  faviconUrl: string | null;
  settings: unknown;
  updatedAt: string;
}

export interface TenantFormValues {
  name: string;
  slug: string;
  displayName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  themeMode: string;
}

export interface ProvisionTenantResult {
  tenant: TenantDetail;
  initialAdmin?: { id: string; email: string; role: string };
}
