import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { deleteMaterial } from "@/app/actions/catalog";
import { formatCents } from "@/lib/core/format";
import { UNIT_LABELS, isUnit } from "@/lib/niches";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";

export default async function MateriaisPage() {
  const ctx = await requireContext();

  const materials = await prisma.material.findMany({
    where: { companyId: ctx.company.id },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Materiais"
        description="Insumos e seus custos por unidade."
        action={
          <Link href="/materiais/novo">
            <Button>
              <Plus className="h-4 w-4" /> Novo material
            </Button>
          </Link>
        }
      />

      {materials.length === 0 ? (
        <EmptyState
          title="Nenhum material ainda"
          description="Clique em 'Novo material' para cadastrar seus insumos."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-border bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-soft text-left text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Unidade</th>
                <th className="px-4 py-3 text-right font-medium">Custo</th>
                <th className="px-4 py-3 font-medium">Fornecedor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className="border-t border-surface-border">
                  <td className="px-4 py-3 font-medium text-ink">{m.name}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {isUnit(m.unit) ? UNIT_LABELS[m.unit] : m.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-ink">{formatCents(m.costCents)}</td>
                  <td className="px-4 py-3 text-ink-soft">{m.supplier ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        m.active
                          ? "rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                          : "rounded bg-surface-soft px-2 py-0.5 text-xs text-ink-faint"
                      }
                    >
                      {m.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/materiais/${m.id}`}
                        className="rounded-lg p-2 text-ink-faint hover:bg-surface-soft hover:text-ink"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <DeleteButton action={deleteMaterial} id={m.id} />
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
