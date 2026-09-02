-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "contactCooldownDays" INTEGER NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE "contact_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "outcome" TEXT NOT NULL DEFAULT 'realizado',
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_logs_companyId_contactedAt_idx" ON "contact_logs"("companyId", "contactedAt");

-- CreateIndex
CREATE INDEX "contact_logs_customerId_contactedAt_idx" ON "contact_logs"("customerId", "contactedAt");

-- AddForeignKey
ALTER TABLE "contact_logs" ADD CONSTRAINT "contact_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_logs" ADD CONSTRAINT "contact_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_logs" ADD CONSTRAINT "contact_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

