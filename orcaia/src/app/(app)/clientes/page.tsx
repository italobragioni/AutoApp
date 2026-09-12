import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";

export default async function ClientesPage() {
  const ctx = await requireContext();

  const clientes = await prisma.customer.findMany({
    where: { companyId: ctx.company.id },
    orderBy: { name: "asc" },
    take: 100,
  });

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cadastro de clientes da empresa."
      />

      {clientes.length === 0 ? (
        <EmptyState
          title="Nenhum cliente ainda"
          description="Os formularios de cadastro entram na proxima etapa. A estrutura de dados ja esta pronta."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-surface-soft text-left text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-t border-surface-border">
                  <td className="px-4 py-3 text-ink">{c.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{c.phone ?? "-"}</td>
                  <td className="px-4 py-3 text-ink-soft">{c.email ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
