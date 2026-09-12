import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { deleteCustomer } from "@/app/actions/customers";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";

export default async function ClientesPage() {
  const ctx = await requireContext();

  const clientes = await prisma.customer.findMany({
    where: { companyId: ctx.company.id },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cadastro de clientes da empresa."
        action={
          <Link href="/clientes/novo">
            <Button>
              <Plus className="h-4 w-4" /> Novo cliente
            </Button>
          </Link>
        }
      />

      {clientes.length === 0 ? (
        <EmptyState
          title="Nenhum cliente ainda"
          description="Clique em 'Novo cliente' para cadastrar o primeiro."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-border bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-soft text-left text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">CPF/CNPJ</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-t border-surface-border">
                  <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{c.document ?? "-"}</td>
                  <td className="px-4 py-3 text-ink-soft">{c.phone ?? "-"}</td>
                  <td className="px-4 py-3 text-ink-soft">{c.whatsapp ?? "-"}</td>
                  <td className="px-4 py-3 text-ink-soft">{c.email ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/clientes/${c.id}`}
                        className="rounded-lg p-2 text-ink-faint hover:bg-surface-soft hover:text-ink"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <DeleteButton action={deleteCustomer} id={c.id} />
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
