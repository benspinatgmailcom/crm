-- Add opportunity owner (required). Backfill existing rows then set NOT NULL.
-- Backfill strategy: use oldest ADMIN user by createdAt; if no ADMIN, use oldest user by createdAt.
-- If no users exist, this migration fails with instructions.

-- Step 1: Add column as nullable
ALTER TABLE "Opportunity" ADD COLUMN "ownerId" TEXT;

-- Step 2: Backfill existing opportunities
DO $$
DECLARE
  default_owner_id TEXT;
BEGIN
  -- Prefer oldest ADMIN; otherwise oldest user by createdAt
  SELECT id INTO default_owner_id
  FROM "User"
  WHERE "isActive" = true
  ORDER BY CASE WHEN role = 'ADMIN' THEN 0 ELSE 1 END, "createdAt" ASC
  LIMIT 1;

  IF default_owner_id IS NULL THEN
    RAISE EXCEPTION 'Cannot backfill Opportunity.ownerId: no users exist. Create at least one user (e.g. register via POST /auth/register) then run this migration again.';
  END IF;

  UPDATE "Opportunity" SET "ownerId" = default_owner_id WHERE "ownerId" IS NULL;
END $$;

-- Step 3: Enforce NOT NULL
ALTER TABLE "Opportunity" ALTER COLUMN "ownerId" SET NOT NULL;

-- Step 4: Foreign key and index
CREATE INDEX "Opportunity_ownerId_idx" ON "Opportunity"("ownerId");
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
