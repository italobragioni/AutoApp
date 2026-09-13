-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "deliveryTime" TEXT,
ADD COLUMN     "paymentTerms" TEXT;

-- CreateTable
CREATE TABLE "steel_materials" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "pricePerUnitCents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "steel_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steel_products" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "baseUnit" TEXT NOT NULL DEFAULT 'm2',
    "materialName" TEXT,
    "materialCostPerBaseCents" INTEGER NOT NULL DEFAULT 0,
    "laborCostPerBaseCents" INTEGER NOT NULL DEFAULT 0,
    "paintCostPerBaseCents" INTEGER NOT NULL DEFAULT 0,
    "weightPerBaseKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginBps" INTEGER NOT NULL DEFAULT 2000,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "steel_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "steel_materials_companyId_idx" ON "steel_materials"("companyId");

-- CreateIndex
CREATE INDEX "steel_products_companyId_idx" ON "steel_products"("companyId");

-- AddForeignKey
ALTER TABLE "steel_materials" ADD CONSTRAINT "steel_materials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steel_products" ADD CONSTRAINT "steel_products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
