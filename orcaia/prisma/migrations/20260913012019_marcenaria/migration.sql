-- CreateTable
CREATE TABLE "wood_materials" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "thicknessMm" INTEGER NOT NULL,
    "pricePerM2Cents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wood_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wood_finishes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerM2Cents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wood_finishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wood_hardware" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wood_hardware_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wood_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "areaMode" TEXT NOT NULL DEFAULT 'caixa',
    "materialId" TEXT,
    "finishId" TEXT,
    "laborPerM2Cents" INTEGER NOT NULL DEFAULT 0,
    "assemblyPerM2Cents" INTEGER NOT NULL DEFAULT 0,
    "marginBps" INTEGER NOT NULL DEFAULT 2000,
    "defaultWidthMm" INTEGER,
    "defaultHeightMm" INTEGER,
    "defaultDepthMm" INTEGER,
    "hardware" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wood_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wood_materials_companyId_idx" ON "wood_materials"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "wood_materials_companyId_name_thicknessMm_key" ON "wood_materials"("companyId", "name", "thicknessMm");

-- CreateIndex
CREATE INDEX "wood_finishes_companyId_idx" ON "wood_finishes"("companyId");

-- CreateIndex
CREATE INDEX "wood_hardware_companyId_idx" ON "wood_hardware"("companyId");

-- CreateIndex
CREATE INDEX "wood_templates_companyId_idx" ON "wood_templates"("companyId");

-- AddForeignKey
ALTER TABLE "wood_materials" ADD CONSTRAINT "wood_materials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wood_finishes" ADD CONSTRAINT "wood_finishes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wood_hardware" ADD CONSTRAINT "wood_hardware_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wood_templates" ADD CONSTRAINT "wood_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
