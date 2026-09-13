import Link from "next/link";
import { Zap, FileText, Users } from "lucide-react";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { getNiche } from "@/lib/niches";
import { formatCents } from "@/lib/core/format";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

const QUOTE_NICHES = ["vidracaria", "serralheria", "marcenaria"];

export default async function DashboardPage() {
  const ctx = await requireContext();
  const companyId = ctx.company.id;
  const niche = getNiche(ctx.company.niche);
  const hasQuotes = QUOTE_NICHES.includes(ctx.company.niche);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [monthQuotes, pendentes, clientes] = await Promise.all([
    hasQuotes
      ? prisma.quote.findMany({
          where: { companyId, createdAt: { gte: monthStart } },
          select: { status: true, totalCents: true },
        })
      : Promise.resolve([] as { status: string; totalCents: number }[]),
    hasQuotes
      ? prisma.quote.count({
          where: { companyId, status: { in: ["enviado", "em_negociacao"] } },
        })
      : Promise.resolve(0),
    prisma.customer.count({ where: { companyId } }),
  ]);

  const count = monthQuotes.length;
  const totalOrcado = monthQuotes.reduce((s, q) => s + q.totalCents, 0);
  const aprovados = monthQuotes.filter((q) => q.status === "aprovado");
  const valorAprovado = aprovados.reduce((s, q) => s + q.totalCents, 0);
  const taxa = count > 0 ? Math.round((aprovados.length / count) * 100) : 0;
  const valorMedio = count > 0 ? Math.round(totalOrcado / count) : 0;

  return (
    <>
      <PageHeader
        title={`Ola, ${ctx.user.name.split(" ")[0]}`}
        description={`${ctx.company.name} · ${niche?.label ?? ctx.company.niche}`}
      />

      {hasQuotes ? (
        <>
          {/* CTA principal — gerador rapido */}
          <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 border-brand/30 bg-brand-muted">
            <div>
              <p className="text-base font-semibold text-ink">Gerar orçamento rápido</p>
              <p className="text-sm text-ink-soft">Crie um orçamento em poucos segundos: cliente, modelo, medidas e pronto.</p>
            </div>
            <Link href="/orcamentos/rapido">
              <Button className="whitespace-nowrap">
                <Zap className="h-4 w-4" /> Gerar rápido
              </Button>
            </Link>
          </Card>

          <h2 className="mb-3 text-sm font-semibold text-ink-soft">Este mês</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Metric title="Orçamentos do mês" value={String(count)} />
            <Metric title="Valor total orçado" value={formatCents(totalOrcado)} />
            <Metric title="Valor aprovado" value={formatCents(valorAprovado)} />
            <Metric title="Taxa de aprovação" value={`${taxa}%`} />
            <Metric title="Valor médio" value={formatCents(valorMedio)} />
            <Metric title="Orçamentos pendentes" value={String(pendentes)} hint="Aguardando resposta" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/orcamentos">
              <Button variant="secondary"><FileText className="h-4 w-4" /> Ver orçamentos</Button>
            </Link>
            <Link href="/clientes">
              <Button variant="secondary"><Users className="h-4 w-4" /> Clientes ({clientes})</Button>
            </Link>
          </div>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Metric title="Clientes" value={String(clientes)} />
        </div>
      )}
    </>
  );
}

function Metric({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardTitle className="text-ink-faint">{title}</CardTitle>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </Card>
  );
}
