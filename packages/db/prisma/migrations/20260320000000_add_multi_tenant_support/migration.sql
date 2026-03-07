-- Multi-tenant support: add Tenant model and required tenantId to all tenant-scoped tables.
-- Backfill: one default tenant is created; all existing rows are assigned to it.

-- Step 1: Create Tenant table
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT,
    "accentColor" TEXT,
    "themeMode" TEXT,
    "customDomain" TEXT,
    "subdomain" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE UNIQUE INDEX "Tenant_customDomain_key" ON "Tenant"("customDomain");
CREATE UNIQUE INDEX "Tenant_subdomain_key" ON "Tenant"("subdomain");

-- Step 2: Insert default tenant for backfill
INSERT INTO "Tenant" ("id", "name", "slug", "isActive", "createdAt", "updatedAt")
VALUES ('clp7defaulttenant00000000000001', 'Default', 'default', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Step 3: User - add tenantId, then change email uniqueness to tenant-scoped
ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;

UPDATE "User" SET "tenantId" = 'clp7defaulttenant00000000000001' WHERE "tenantId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;

DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- Step 4: Account
ALTER TABLE "Account" ADD COLUMN "tenantId" TEXT;
UPDATE "Account" SET "tenantId" = 'clp7defaulttenant00000000000001' WHERE "tenantId" IS NULL;
ALTER TABLE "Account" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Account" ADD CONSTRAINT "Account_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Account_tenantId_idx" ON "Account"("tenantId");
CREATE INDEX "Account_tenantId_name_idx" ON "Account"("tenantId", "name");

-- Step 5: Contact
ALTER TABLE "Contact" ADD COLUMN "tenantId" TEXT;
UPDATE "Contact" SET "tenantId" = 'clp7defaulttenant00000000000001' WHERE "tenantId" IS NULL;
ALTER TABLE "Contact" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Contact_tenantId_idx" ON "Contact"("tenantId");

-- Step 6: Lead
ALTER TABLE "Lead" ADD COLUMN "tenantId" TEXT;
UPDATE "Lead" SET "tenantId" = 'clp7defaulttenant00000000000001' WHERE "tenantId" IS NULL;
ALTER TABLE "Lead" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Lead_tenantId_idx" ON "Lead"("tenantId");

-- Step 7: Opportunity
ALTER TABLE "Opportunity" ADD COLUMN "tenantId" TEXT;
UPDATE "Opportunity" SET "tenantId" = 'clp7defaulttenant00000000000001' WHERE "tenantId" IS NULL;
ALTER TABLE "Opportunity" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Opportunity_tenantId_idx" ON "Opportunity"("tenantId");
CREATE INDEX "Opportunity_tenantId_name_idx" ON "Opportunity"("tenantId", "name");
CREATE INDEX "Opportunity_tenantId_stage_idx" ON "Opportunity"("tenantId", "stage");
CREATE INDEX "Opportunity_tenantId_ownerId_idx" ON "Opportunity"("tenantId", "ownerId");

-- Step 8: OpportunityContact
ALTER TABLE "OpportunityContact" ADD COLUMN "tenantId" TEXT;
UPDATE "OpportunityContact" SET "tenantId" = 'clp7defaulttenant00000000000001' WHERE "tenantId" IS NULL;
ALTER TABLE "OpportunityContact" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "OpportunityContact" ADD CONSTRAINT "OpportunityContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "OpportunityContact_tenantId_idx" ON "OpportunityContact"("tenantId");

-- Step 9: Activity
ALTER TABLE "Activity" ADD COLUMN "tenantId" TEXT;
UPDATE "Activity" SET "tenantId" = 'clp7defaulttenant00000000000001' WHERE "tenantId" IS NULL;
ALTER TABLE "Activity" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Activity_tenantId_idx" ON "Activity"("tenantId");
CREATE INDEX "Activity_tenantId_entityType_entityId_idx" ON "Activity"("tenantId", "entityType", "entityId");

-- Step 10: Attachment
ALTER TABLE "Attachment" ADD COLUMN "tenantId" TEXT;
UPDATE "Attachment" SET "tenantId" = 'clp7defaulttenant00000000000001' WHERE "tenantId" IS NULL;
ALTER TABLE "Attachment" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Attachment_tenantId_idx" ON "Attachment"("tenantId");
CREATE INDEX "Attachment_tenantId_entityType_entityId_idx" ON "Attachment"("tenantId", "entityType", "entityId");

-- Step 11: RefreshToken
ALTER TABLE "RefreshToken" ADD COLUMN "tenantId" TEXT;
UPDATE "RefreshToken" SET "tenantId" = (SELECT "tenantId" FROM "User" WHERE "User"."id" = "RefreshToken"."userId" LIMIT 1);
-- RefreshTokens without a matching user (shouldn't happen) get default tenant
UPDATE "RefreshToken" SET "tenantId" = 'clp7defaulttenant00000000000001' WHERE "tenantId" IS NULL;
ALTER TABLE "RefreshToken" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "RefreshToken_tenantId_idx" ON "RefreshToken"("tenantId");

-- Step 12: PasswordResetToken
ALTER TABLE "PasswordResetToken" ADD COLUMN "tenantId" TEXT;
UPDATE "PasswordResetToken" SET "tenantId" = (SELECT "tenantId" FROM "User" WHERE "User"."id" = "PasswordResetToken"."userId" LIMIT 1);
UPDATE "PasswordResetToken" SET "tenantId" = 'clp7defaulttenant00000000000001' WHERE "tenantId" IS NULL;
ALTER TABLE "PasswordResetToken" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "PasswordResetToken_tenantId_idx" ON "PasswordResetToken"("tenantId");
