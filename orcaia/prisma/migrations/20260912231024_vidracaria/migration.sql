-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "installationCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otherCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "travelCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "glass_options" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "glassType" TEXT NOT NULL,
    "thicknessMm" INTEGER NOT NULL,
    "pricePerM2Cents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "glass_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finish_options" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ml',
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finish_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hardware_options" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hardware_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "glass_options_companyId_idx" ON "glass_options"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "glass_options_companyId_glassType_thicknessMm_key" ON "glass_options"("companyId", "glassType", "thicknessMm");

-- CreateIndex
CREATE INDEX "finish_options_companyId_idx" ON "finish_options"("companyId");

-- CreateIndex
CREATE INDEX "hardware_options_companyId_idx" ON "hardware_options"("companyId");

-- AddForeignKey
ALTER TABLE "glass_options" ADD CONSTRAINT "glass_options_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finish_options" ADD CONSTRAINT "finish_options_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_options" ADD CONSTRAINT "hardware_options_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
