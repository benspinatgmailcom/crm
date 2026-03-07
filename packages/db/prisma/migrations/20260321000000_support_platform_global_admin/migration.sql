-- Support platform global admin: optional User.tenantId, UserRole enum (with GLOBAL_ADMIN), TenantStatus enum on Tenant.

-- Step 1: Create UserRole enum and migrate User.role from TEXT to UserRole
CREATE TYPE "UserRole" AS ENUM ('GLOBAL_ADMIN', 'ADMIN', 'USER', 'VIEWER');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER'::"UserRole";

-- Step 2: Make User.tenantId nullable (platform users have no tenant)
ALTER TABLE "User" ALTER COLUMN "tenantId" DROP NOT NULL;

-- Step 3: Create TenantStatus enum and add Tenant.status
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

ALTER TABLE "Tenant" ADD COLUMN "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE';
