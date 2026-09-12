import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { deleteProduct } from "@/app/actions/catalog";
import { formatCents } from "@/lib/core/format";
import { UNIT_LABELS, isUnit } from "@/lib/niches";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";

export default async function ProdutosPage() {
  const ctx = await requireContext();

  const products = await prisma.product.findMany({
    where: { companyId: ctx.company.id },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Produtos e servicos"
        description="Catalogo de itens ofertaveis da empresa."
        action={
          <Link href="/produtos/novo">
            <Button>
              <Plus className="h-4 w-4" /> Novo produto
            </Button>
          </Link>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          title="Nenhum produto ou servico ainda"
          description="Clique em 'Novo produto' para comecar o catalogo."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-border bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-soft text-left text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Unidade</th>
                <th className="px-4 py-3 text-right font-medium">Preco base</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-surface-border">
                  <td className="px-4 py-3 font-medium text-ink">{p.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{p.category ?? "-"}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {isUnit(p.unit) ? UNIT_LABELS[p.unit] : p.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-ink">
                    {p.basePriceCents != null ? formatCents(p.basePriceCents) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.active
                          ? "rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                          : "rounded bg-surface-soft px-2 py-0.5 text-xs text-ink-faint"
                      }
                    >
                      {p.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/produtos/${p.id}`}
                        className="rounded-lg p-2 text-ink-faint hover:bg-surface-soft hover:text-ink"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <DeleteButton action={deleteProduct} id={p.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
