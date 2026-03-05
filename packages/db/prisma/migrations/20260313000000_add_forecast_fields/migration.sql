-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "winProbability" INTEGER,
ADD COLUMN "forecastCategory" TEXT,
ADD COLUMN "expectedRevenue" DECIMAL(14,2);

-- CreateIndex
CREATE INDEX "Opportunity_forecastCategory_idx" ON "Opportunity"("forecastCategory");

-- CreateIndex
CREATE INDEX "Opportunity_ownerId_forecastCategory_idx" ON "Opportunity"("ownerId", "forecastCategory");
