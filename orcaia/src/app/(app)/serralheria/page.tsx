import Link from "next/link";
import { Pencil } from "lucide-react";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { formatCents, formatBps } from "@/lib/core/format";
import { materialUnitLabel, serviceTypeLabel, baseUnitLabel } from "@/lib/niches/serralheria/options";
import {
  createSteelMaterial,
  deleteSteelMaterial,
  createSteelProduct,
  deleteSteelProduct,
} from "@/app/actions/serralheria-catalog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";
import { Card, CardTitle } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { SteelMaterialForm, SteelProductForm } from "@/components/forms/SerralheriaForms";

export default async function SerralheriaPage() {
  const ctx = await requireContext();

  if (ctx.company.niche !== "serralheria") {
    return (
      <>
        <PageHeader title="Materiais e produtos" />
        <EmptyState
          title="Módulo exclusivo de serralherias"
          description="Este catálogo aparece apenas para empresas do nicho Serralheria."
        />
      </>
    );
  }

  const companyId = ctx.company.id;
  const [materials, products] = await Promise.all([
    prisma.steelMaterial.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.steelProduct.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
  ]);
  const materialNames = materials.map((m) => m.name);

  return (
    <>
      <PageHeader
        title="Materiais e produtos"
        description="Materiais de referência e produtos/serviços com preços e fórmula configuráveis."
      />

      <div className="space-y-6">
        {/* Materiais */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Novo material</CardTitle>
            <p className="mt-1 mb-3 text-sm text-ink-faint">Ferro, Aço carbono, Alumínio, Inox… preço de referência.</p>
            <SteelMaterialForm action={createSteelMaterial} />
          </Card>
          <Card>
            <CardTitle>Materiais cadastrados</CardTitle>
            {materials.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">Nenhum material cadastrado.</p>
            ) : (
              <ul className="mt-3 divide-y divide-surface-border">
                {materials.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink">
                      {m.name}
                      <span className="ml-2 text-ink-faint">
                        {formatCents(m.pricePerUnitCents)} / {materialUnitLabel(m.unit)}
                      </span>
                    </span>
                    <DeleteButton action={deleteSteelMaterial} id={m.id} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Produtos */}
        <Card>
          <CardTitle>Novo produto / serviço</CardTitle>
          <p className="mt-1 mb-3 text-sm text-ink-faint">
            Defina a unidade base (a fórmula) e os custos por unidade base.
          </p>
          <SteelProductForm action={createSteelProduct} materialNames={materialNames} />
        </Card>

        <Card>
          <CardTitle>Produtos cadastrados</CardTitle>
          {products.length === 0 ? (
            <p className="mt-3 text-sm text-ink-faint">Nenhum produto cadastrado.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-surface-soft text-left text-ink-faint">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">Serviço</th>
                    <th className="px-3 py-2 font-medium">Base</th>
                    <th className="px-3 py-2 text-right font-medium">Material</th>
                    <th className="px-3 py-2 text-right font-medium">M. obra</th>
                    <th className="px-3 py-2 text-right font-medium">Margem</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-t border-surface-border">
                      <td className="px-3 py-2 font-medium text-ink">{p.name}</td>
                      <td className="px-3 py-2 text-ink-soft">{serviceTypeLabel(p.serviceType)}</td>
                      <td className="px-3 py-2 text-ink-soft">{baseUnitLabel(p.baseUnit)}</td>
                      <td className="px-3 py-2 text-right text-ink-soft">{formatCents(p.materialCostPerBaseCents)}</td>
                      <td className="px-3 py-2 text-right text-ink-soft">{formatCents(p.laborCostPerBaseCents)}</td>
                      <td className="px-3 py-2 text-right text-ink-soft">{formatBps(p.marginBps)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/serralheria/${p.id}`} className="rounded-lg p-2 text-ink-faint hover:bg-surface-soft hover:text-ink" aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <DeleteButton action={deleteSteelProduct} id={p.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
