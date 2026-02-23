-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN "storageDriver" TEXT NOT NULL DEFAULT 'local';

-- Backfill: rows with bucket set were stored in S3
UPDATE "Attachment" SET "storageDriver" = 's3' WHERE "bucket" IS NOT NULL;
