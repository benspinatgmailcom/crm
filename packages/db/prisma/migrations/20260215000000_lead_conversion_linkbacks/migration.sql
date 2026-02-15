-- AlterTable Lead: add converted fields
ALTER TABLE "Lead" ADD COLUMN "convertedAccountId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "convertedContactId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "convertedOpportunityId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "convertedAt" TIMESTAMP(3);

-- AlterTable Account: add sourceLeadId
ALTER TABLE "Account" ADD COLUMN "sourceLeadId" TEXT;
CREATE UNIQUE INDEX "Account_sourceLeadId_key" ON "Account"("sourceLeadId");
ALTER TABLE "Account" ADD CONSTRAINT "Account_sourceLeadId_fkey" FOREIGN KEY ("sourceLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable Contact: add sourceLeadId
ALTER TABLE "Contact" ADD COLUMN "sourceLeadId" TEXT;
CREATE UNIQUE INDEX "Contact_sourceLeadId_key" ON "Contact"("sourceLeadId");
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_sourceLeadId_fkey" FOREIGN KEY ("sourceLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable Opportunity: add sourceLeadId
ALTER TABLE "Opportunity" ADD COLUMN "sourceLeadId" TEXT;
CREATE UNIQUE INDEX "Opportunity_sourceLeadId_key" ON "Opportunity"("sourceLeadId");
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_sourceLeadId_fkey" FOREIGN KEY ("sourceLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
