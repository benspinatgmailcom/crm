-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "healthScore" INTEGER,
ADD COLUMN     "healthSignals" JSONB,
ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "lastStageChangedAt" TIMESTAMP(3),
ADD COLUMN     "nextFollowUpAt" TIMESTAMP(3);
