-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "attributionWindowDays" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "campaign_participants" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "sentAt" TIMESTAMP(3),
    "workOrderId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaign_participants_workOrderId_key" ON "campaign_participants"("workOrderId");

-- CreateIndex
CREATE INDEX "campaign_participants_companyId_customerId_idx" ON "campaign_participants"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "campaign_participants_campaignId_status_idx" ON "campaign_participants"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_participants_campaignId_customerId_key" ON "campaign_participants"("campaignId", "customerId");

-- AddForeignKey
ALTER TABLE "campaign_participants" ADD CONSTRAINT "campaign_participants_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_participants" ADD CONSTRAINT "campaign_participants_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_participants" ADD CONSTRAINT "campaign_participants_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_participants" ADD CONSTRAINT "campaign_participants_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

