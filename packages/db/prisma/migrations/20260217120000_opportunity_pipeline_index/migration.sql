-- CreateIndex
CREATE INDEX "Opportunity_stage_updatedAt_closeDate_idx" ON "Opportunity"("stage", "updatedAt", "closeDate");
