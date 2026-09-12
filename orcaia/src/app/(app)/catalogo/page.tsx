import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { getNiche } from "@/lib/niches";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";

// Catalogo reune Produtos/Servicos, Materiais e Mao de obra. Nesta etapa mostra
// os contadores e os campos especificos do nicho ativo (ilustrando a preparacao
// multi-nicho). Os CRUDs entram na proxima etapa.
export default async function CatalogoPage() {
  const ctx = await requireContext();
  const companyId = ctx.company.id;
  const niche = getNiche(ctx.company.niche);

  const [products, materials, labor] = await Promise.all([
    prisma.product.count({ where: { companyId } }),
    prisma.material.count({ where: { companyId } }),
    prisma.laborRate.count({ where: { companyId } }),
  ]);

  return (
    <>
      <PageHeader
        title="Catalogo"
        description="Produtos/servicos, materiais e mao de obra."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardTitle className="text-ink-faint">Produtos / Servicos</CardTitle>
          <p className="mt-2 text-2xl font-bold text-ink">{products}</p>
        </Card>
        <Card>
          <CardTitle className="text-ink-faint">Materiais</CardTitle>
          <p className="mt-2 text-2xl font-bold text-ink">{materials}</p>
        </Card>
        <Card>
          <CardTitle className="text-ink-faint">Mao de obra</CardTitle>
          <p className="mt-2 text-2xl font-bold text-ink">{labor}</p>
        </Card>
      </div>

      {niche ? (
        <Card className="mt-6">
          <CardTitle>Campos do nicho: {niche.label}</CardTitle>
          <p className="mt-1 text-sm text-ink-soft">
            Cada item do orcamento captura estes campos, usados para calcular a
            quantidade automaticamente.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {niche.itemFields.map((f) => (
              <li
                key={f.key}
                className="rounded-lg bg-surface-soft px-3 py-1 text-sm text-ink-soft"
              >
                {f.label}
                {f.suffix ? ` (${f.suffix})` : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="mt-6">
        <EmptyState
          title="Cadastros do catalogo entram na proxima etapa"
          description="Schema, unidades por nicho e o motor de precificacao ja estao prontos."
        />
      </div>
    </>
  );
}
