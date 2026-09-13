import Link from "next/link";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { formatCents } from "@/lib/core/format";
import { bpsToInput } from "@/lib/core/money";
import { serviceTypeLabel, baseUnitLabel } from "@/lib/niches/serralheria/options";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { QuickQuote } from "@/components/quote/QuickQuote";

const QUOTE_NICHES = ["vidracaria", "serralheria", "marcenaria"];

export default async function GeradorRapidoPage() {
  const ctx = await requireContext();
  const niche = ctx.company.niche;
  const companyId = ctx.company.id;

  if (!QUOTE_NICHES.includes(niche)) {
    return (
      <>
        <PageHeader title="Gerador rápido" />
        <EmptyState title="Disponível para Vidraçaria, Serralheria e Marcenaria" />
      </>
    );
  }

  const [customers, company] = await Promise.all([
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { defaultMarginBps: true } }),
  ]);

  if (customers.length === 0) {
    return (
      <>
        <PageHeader title="Gerador rápido" />
        <EmptyState title="Cadastre um cliente primeiro" description="O orçamento precisa de um cliente." />
        <div className="mt-4">
          <Link href="/clientes/novo"><Button>Cadastrar cliente</Button></Link>
        </div>
      </>
    );
  }

  const marginDefault = bpsToInput(company?.defaultMarginBps ?? 2000);
  const header = (
    <PageHeader title="Gerador rápido de orçamento" description="Cliente, produto, medidas e pronto — em segundos." />
  );

  const catalogEmpty = (label: string, href: string) => (
    <>
      {header}
      <EmptyState title={`Cadastre ${label} primeiro`} description="O gerador rápido usa seu catálogo." />
      <div className="mt-4"><Link href={href}><Button>Ir para o catálogo</Button></Link></div>
    </>
  );

  if (niche === "vidracaria") {
    const [glass, finishes, hardware] = await Promise.all([
      prisma.glassOption.findMany({ where: { companyId, active: true }, orderBy: [{ glassType: "asc" }, { thicknessMm: "asc" }] }),
      prisma.finishOption.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } }),
      prisma.hardwareOption.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } }),
    ]);
    if (glass.length === 0) return catalogEmpty("vidros", "/vidros");
    return (
      <>
        {header}
        <QuickQuote
          niche={niche}
          customers={customers}
          marginDefault={marginDefault}
          glass={glass.map((g) => ({ id: g.id, label: `${g.glassType} ${g.thicknessMm}mm — ${formatCents(g.pricePerM2Cents)}/m²`, pricePerM2Cents: g.pricePerM2Cents }))}
          finishes={finishes.map((f) => ({ id: f.id, label: `${f.name}`, unit: f.unit as "m2" | "ml" | "fixo", priceCents: f.priceCents }))}
          hardware={hardware.map((h) => ({ id: h.id, name: h.name, priceCents: h.priceCents }))}
        />
      </>
    );
  }

  if (niche === "serralheria") {
    const products = await prisma.steelProduct.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } });
    if (products.length === 0) return catalogEmpty("produtos/serviços", "/serralheria");
    return (
      <>
        {header}
        <QuickQuote
          niche={niche}
          customers={customers}
          marginDefault={marginDefault}
          products={products.map((p) => ({
            id: p.id,
            label: `${p.name} — ${serviceTypeLabel(p.serviceType)} (${baseUnitLabel(p.baseUnit)})`,
            baseUnit: p.baseUnit as "un" | "ml" | "m2" | "kg",
            materialCostPerBaseCents: p.materialCostPerBaseCents,
            laborCostPerBaseCents: p.laborCostPerBaseCents,
            paintCostPerBaseCents: p.paintCostPerBaseCents,
            weightPerBaseKg: p.weightPerBaseKg,
          }))}
        />
      </>
    );
  }

  // marcenaria
  const [templates, materials, finishes, hardware] = await Promise.all([
    prisma.woodTemplate.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } }),
    prisma.woodMaterial.findMany({ where: { companyId, active: true }, orderBy: [{ name: "asc" }, { thicknessMm: "asc" }] }),
    prisma.woodFinish.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } }),
    prisma.woodHardware.findMany({ where: { companyId, active: true } }),
  ]);
  if (templates.length === 0) return catalogEmpty("modelos de produto", "/marcenaria");

  const matPrice = new Map(materials.map((m) => [m.id, m.pricePerM2Cents]));
  const finPrice = new Map(finishes.map((f) => [f.id, f.pricePerM2Cents]));
  const hwPrice = new Map(hardware.map((h) => [h.id, h.priceCents]));

  return (
    <>
      {header}
      <QuickQuote
        niche={niche}
        customers={customers}
        marginDefault={marginDefault}
        templates={templates.map((t) => {
          const tplHardware = Array.isArray(t.hardware)
            ? (t.hardware as { hardwareId?: string; quantity?: number }[])
            : [];
          return {
            id: t.id,
            label: t.category ? `${t.name} (${t.category})` : t.name,
            areaMode: t.areaMode as "frontal" | "caixa",
            materialPriceCents: t.materialId ? matPrice.get(t.materialId) ?? 0 : 0,
            finishPriceCents: t.finishId ? finPrice.get(t.finishId) ?? 0 : 0,
            laborPerM2Cents: t.laborPerM2Cents,
            assemblyPerM2Cents: t.assemblyPerM2Cents,
            hardware: tplHardware
              .filter((h) => h.hardwareId && h.quantity)
              .map((h) => ({ quantity: h.quantity as number, unitPriceCents: hwPrice.get(h.hardwareId as string) ?? 0 })),
            defaultWidthMm: t.defaultWidthMm ?? 0,
            defaultHeightMm: t.defaultHeightMm ?? 0,
            defaultDepthMm: t.defaultDepthMm ?? 0,
          };
        })}
        woodMaterials={materials.map((m) => ({ id: m.id, label: `${m.name} ${m.thicknessMm}mm`, pricePerM2Cents: m.pricePerM2Cents }))}
        woodFinishes={finishes.map((f) => ({ id: f.id, label: f.name, pricePerM2Cents: f.pricePerM2Cents }))}
      />
    </>
  );
}
