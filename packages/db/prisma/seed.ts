/// <reference types="node" />
/**
 * Multi-tenant seed: creates two tenants (Acme Telecom, Northstar Health), each with
 * users, accounts, contacts, leads, opportunities, activities, and attachment metadata.
 * Also ensures one GLOBAL_ADMIN platform user exists (dev only, not attached to any tenant).
 * Uses shared tenant default settings (pipeline/activity config) for consistency with provisioning.
 * Run: pnpm db:seed (from repo root) or pnpm exec prisma db seed (from packages/db).
 */
import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { getDefaultTenantSettings } from "@crm/shared";

console.log("🌱 SEED SCRIPT EXECUTING");

const prisma = new PrismaClient();

const SEED_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

// ---------------------------------------------------------------------------
// DEV ONLY: Global Admin for platform management. Do not use in production.
// Credentials: global-admin@platform.local / GlobalAdmin123!
// ---------------------------------------------------------------------------
const GLOBAL_ADMIN_EMAIL = "global-admin@platform.local";
const GLOBAL_ADMIN_PASSWORD = "GlobalAdmin123!";

/** Hash password once for all seeded users (dev/test only). */
async function hashPassword(): Promise<string> {
  return bcrypt.hash(SEED_PASSWORD, 10);
}

/**
 * Delete all tenant-scoped data and tenants in FK-safe order.
 * Leaves any existing users with tenantId = null (e.g. global admins) untouched.
 */
async function deleteTenantData(): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.opportunityContact.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.account.deleteMany();
  const tenantIds = (await prisma.tenant.findMany({ select: { id: true } })).map((t) => t.id);
  if (tenantIds.length > 0) {
    await prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
  }
  await prisma.tenant.deleteMany();
}

/**
 * Create a tenant with optional branding fields.
 * Seed/demo tenants use static assets from apps/web/public/tenants/<slug-prefix>/ (see public/tenants/README.md).
 */
async function createTenant(params: {
  name: string;
  slug: string;
  displayName?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  accentColor?: string;
}) {
  return prisma.tenant.create({
    data: {
      name: params.name,
      slug: params.slug,
      displayName: params.displayName ?? params.name,
      isActive: true,
      settings: getDefaultTenantSettings() as object,
      ...(params.logoUrl != null && { logoUrl: params.logoUrl }),
      ...(params.faviconUrl != null && { faviconUrl: params.faviconUrl }),
      ...(params.primaryColor != null && { primaryColor: params.primaryColor }),
      ...(params.accentColor != null && { accentColor: params.accentColor }),
    },
  });
}

/**
 * Seed all data for one tenant. Every record receives tenantId.
 * Data is prefixed/typed so it is clearly distinguishable by tenant in the UI.
 */
async function seedTenant(
  tenantId: string,
  options: {
    namePrefix: string;
    industryTheme: string;
    userPrefix: string;
    passwordHash: string;
  }
): Promise<void> {
  const { namePrefix, industryTheme, userPrefix, passwordHash } = options;

  // --- Users (at least 2 with different roles) ---
  const adminUser = await prisma.user.create({
    data: {
      tenantId,
      email: `${userPrefix}-admin@seed.local`,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });
  const regularUser = await prisma.user.create({
    data: {
      tenantId,
      email: `${userPrefix}-user@seed.local`,
      passwordHash,
      role: UserRole.USER,
      isActive: true,
    },
  });
  console.log(`  Users created for ${namePrefix}: ${adminUser.email}, ${regularUser.email}`);

  // --- Accounts (a few per tenant, clearly named by tenant) ---
  const account1 = await prisma.account.create({
    data: {
      tenantId,
      name: `${namePrefix} - Enterprise Customer A`,
      industry: industryTheme,
      website: `https://${options.userPrefix}-customer-a.example.com`,
    },
  });
  const account2 = await prisma.account.create({
    data: {
      tenantId,
      name: `${namePrefix} - Key Account B`,
      industry: industryTheme,
      website: `https://${options.userPrefix}-account-b.example.com`,
    },
  });
  const account3 = await prisma.account.create({
    data: {
      tenantId,
      name: `${namePrefix} - Prospect C`,
      industry: industryTheme,
    },
  });

  // --- Contacts (tied to accounts) ---
  const contact1 = await prisma.contact.create({
    data: {
      tenantId,
      accountId: account1.id,
      firstName: "Jordan",
      lastName: "Smith",
      email: `jordan.smith@${options.userPrefix}-a.local`,
      phone: "+15551234001",
    },
  });
  const contact2 = await prisma.contact.create({
    data: {
      tenantId,
      accountId: account1.id,
      firstName: "Casey",
      lastName: "Jones",
      email: `casey.jones@${options.userPrefix}-a.local`,
    },
  });
  const contact3 = await prisma.contact.create({
    data: {
      tenantId,
      accountId: account2.id,
      firstName: "Morgan",
      lastName: "Lee",
      email: `morgan.lee@${options.userPrefix}-b.local`,
    },
  });

  // --- Leads (distinguishable by company/source) ---
  await prisma.lead.create({
    data: {
      tenantId,
      name: `Lead One ${namePrefix}`,
      email: `lead1@${options.userPrefix}-prospect.local`,
      company: `${namePrefix} Prospect Co 1`,
      status: "new",
      source: "website",
    },
  });
  await prisma.lead.create({
    data: {
      tenantId,
      name: `Lead Two ${namePrefix}`,
      email: `lead2@${options.userPrefix}-prospect.local`,
      company: `${namePrefix} Prospect Co 2`,
      status: "qualified",
      source: "referral",
    },
  });

  // --- Opportunities (ownerId = tenant user) ---
  const opp1 = await prisma.opportunity.create({
    data: {
      tenantId,
      accountId: account1.id,
      ownerId: adminUser.id,
      name: `${namePrefix} - Enterprise Deal 1`,
      amount: 75_000,
      stage: "proposal",
      closeDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
  });
  const opp2 = await prisma.opportunity.create({
    data: {
      tenantId,
      accountId: account2.id,
      ownerId: regularUser.id,
      name: `${namePrefix} - SMB Deal 2`,
      amount: 25_000,
      stage: "discovery",
      closeDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });

  // --- OpportunityContact (buying team) ---
  await prisma.opportunityContact.create({
    data: {
      tenantId,
      opportunityId: opp1.id,
      contactId: contact1.id,
      role: "Champion",
    },
  });
  await prisma.opportunityContact.create({
    data: {
      tenantId,
      opportunityId: opp1.id,
      contactId: contact2.id,
      role: "Technical Stakeholder",
    },
  });

  // --- Activities ---
  await prisma.activity.create({
    data: {
      tenantId,
      entityType: "account",
      entityId: account1.id,
      type: "call",
      payload: { subject: `Intro call - ${namePrefix}`, duration: 30 },
    },
  });
  await prisma.activity.create({
    data: {
      tenantId,
      entityType: "opportunity",
      entityId: opp1.id,
      type: "meeting",
      payload: { subject: `Demo - ${namePrefix}`, attendees: 3 },
    },
  });
  await prisma.activity.create({
    data: {
      tenantId,
      entityType: "opportunity",
      entityId: opp2.id,
      type: "note",
      payload: { body: `Discovery notes for ${namePrefix} SMB deal` },
    },
  });

  // --- Attachments (metadata only; no real files - for tenant isolation testing) ---
  await prisma.attachment.create({
    data: {
      tenantId,
      entityType: "account",
      entityId: account1.id,
      fileName: `${namePrefix}-contract-draft.pdf`,
      mimeType: "application/pdf",
      size: 1024,
      storageKey: `seed/${options.userPrefix}/contract-draft.pdf`,
      storageDriver: "local",
      uploadedByUserId: adminUser.id,
    },
  });
  await prisma.attachment.create({
    data: {
      tenantId,
      entityType: "opportunity",
      entityId: opp1.id,
      fileName: `${namePrefix}-proposal.docx`,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 2048,
      storageKey: `seed/${options.userPrefix}/proposal.docx`,
      storageDriver: "local",
      uploadedByUserId: adminUser.id,
    },
  });
}

/** Ensure one GLOBAL_ADMIN user exists (tenantId = null). Idempotent; uses dev credentials. */
async function ensureGlobalAdmin(): Promise<void> {
  const candidates = await prisma.user.findMany({
    where: { email: GLOBAL_ADMIN_EMAIL },
    select: { id: true, tenantId: true },
  });
  const existing = candidates.find((u) => u.tenantId === null);
  if (existing) {
    console.log("Global admin already exists:", GLOBAL_ADMIN_EMAIL);
    return;
  }
  const globalAdminHash = await bcrypt.hash(GLOBAL_ADMIN_PASSWORD, 10);
  await prisma.user.create({
    data: {
      email: GLOBAL_ADMIN_EMAIL,
      passwordHash: globalAdminHash,
      role: "GLOBAL_ADMIN",
      isActive: true,
      // tenantId omitted so user is platform-level (GLOBAL_ADMIN); schema has tenantId String?
    },
  });
  console.log("Created GLOBAL_ADMIN user (dev only):", GLOBAL_ADMIN_EMAIL, "password:", GLOBAL_ADMIN_PASSWORD);
}

async function main(): Promise<void> {
  await deleteTenantData();

  const passwordHash = await hashPassword();

  // Platform admin: one GLOBAL_ADMIN user, not attached to any tenant (dev credentials only)
  await ensureGlobalAdmin();

  // ---------------------------------------------------------------------------
  // Tenant 1: Acme Telecom (telecom/tech – blue/indigo + amber/orange)
  // Branding: static assets in apps/web/public/tenants/acme/
  // ---------------------------------------------------------------------------
  const tenantAcme = await createTenant({
    name: "Acme Telecom",
    slug: "acme-telecom",
    displayName: "Acme Telecom",
    logoUrl: "/tenants/acme/logo.svg",
    faviconUrl: "/tenants/acme/favicon.svg",
    primaryColor: "#2563eb",
    accentColor: "#f59e0b",
  });
  await seedTenant(tenantAcme.id, {
    namePrefix: "Acme Telecom",
    industryTheme: "Telecommunications",
    userPrefix: "acme",
    passwordHash,
  });
  console.log("Tenant seeded: Acme Telecom");

  // ---------------------------------------------------------------------------
  // Tenant 2: Northstar Health (healthcare – teal/emerald + pink/rose)
  // Branding: static assets in apps/web/public/tenants/northstar/
  // ---------------------------------------------------------------------------
  const tenantNorthstar = await createTenant({
    name: "Northstar Health",
    slug: "northstar-health",
    displayName: "Northstar Health",
    logoUrl: "/tenants/northstar/logo.svg",
    faviconUrl: "/tenants/northstar/favicon.svg",
    primaryColor: "#0d9488",
    accentColor: "#e11d48",
  });
  await seedTenant(tenantNorthstar.id, {
    namePrefix: "Northstar Health",
    industryTheme: "Healthcare",
    userPrefix: "northstar",
    passwordHash,
  });
  console.log("Tenant seeded: Northstar Health");

  console.log("Seed completed. Global admin + two tenants with users, accounts, contacts, leads, opportunities, activities, and attachments.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
