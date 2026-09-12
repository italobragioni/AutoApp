import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { getNiche } from "@/lib/niches";
import { formatBps } from "@/lib/core/format";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietario",
  manager: "Gerente",
  staff: "Colaborador",
};

export default async function ConfiguracoesPage() {
  const ctx = await requireContext();

  const company = await prisma.company.findUnique({
    where: { id: ctx.company.id },
    select: {
      name: true,
      niche: true,
      document: true,
      phone: true,
      email: true,
      defaultMarginBps: true,
      defaultLaborRateCents: true,
      memberships: {
        select: { role: true, user: { select: { name: true, email: true } } },
      },
    },
  });

  const niche = getNiche(company?.niche ?? "");

  return (
    <>
      <PageHeader
        title="Configuracoes"
        description="Dados da empresa, nicho, politicas de preco e usuarios."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Empresa</CardTitle>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Nome" value={company?.name} />
            <Row label="Nicho" value={niche?.label ?? company?.niche} />
            <Row label="CNPJ" value={company?.document} />
            <Row label="Telefone" value={company?.phone} />
            <Row label="E-mail" value={company?.email} />
          </dl>
        </Card>

        <Card>
          <CardTitle>Politicas de preco padrao</CardTitle>
          <dl className="mt-3 space-y-2 text-sm">
            <Row
              label="Margem padrao"
              value={formatBps(company?.defaultMarginBps ?? 0)}
            />
            <Row
              label="Mao de obra padrao"
              value={
                company?.defaultLaborRateCents
                  ? `${(company.defaultLaborRateCents / 100).toLocaleString(
                      "pt-BR",
                      { style: "currency", currency: "BRL" },
                    )} / hora`
                  : "nao definida"
              }
            />
          </dl>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Usuarios e acesso</CardTitle>
        <ul className="mt-3 space-y-2">
          {company?.memberships.map((m, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-lg bg-surface-soft px-3 py-2 text-sm"
            >
              <span className="text-ink">
                {m.user.name}{" "}
                <span className="text-ink-faint">({m.user.email})</span>
              </span>
              <span className="rounded bg-white px-2 py-0.5 text-xs text-ink-soft">
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink-faint">
          Convite de novos usuarios (owner / manager / staff) entra na proxima
          etapa — a estrutura de permissoes ja esta pronta.
        </p>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-right text-ink">{value || "-"}</dd>
    </div>
  );
}
