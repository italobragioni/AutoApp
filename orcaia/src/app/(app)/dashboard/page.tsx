import Link from "next/link";
import { Users, Package, Boxes, Wallet } from "lucide-react";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { getNiche } from "@/lib/niches";
import { formatBps } from "@/lib/core/format";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function DashboardPage() {
  const ctx = await requireContext();
  const companyId = ctx.company.id;

  // Contagens reais, escopadas por empresa.
  const [clientes, produtos, materiais, labor, additional, company] = await Promise.all([
    prisma.customer.count({ where: { companyId } }),
    prisma.product.count({ where: { companyId } }),
    prisma.material.count({ where: { companyId } }),
    prisma.laborRate.count({ where: { companyId } }),
    prisma.additionalCost.count({ where: { companyId } }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { defaultMarginBps: true },
    }),
  ]);

  const niche = getNiche(ctx.company.niche);

  const cards = [
    { title: "Clientes", value: clientes, href: "/clientes", icon: Users },
    { title: "Produtos e servicos", value: produtos, href: "/produtos", icon: Package },
    { title: "Materiais", value: materiais, href: "/materiais", icon: Boxes },
    { title: "Custos cadastrados", value: labor + additional, href: "/custos", icon: Wallet },
  ];

  return (
    <>
      <PageHeader
        title={`Ola, ${ctx.user.name.split(" ")[0]}`}
        description={`${ctx.company.name} · ${niche?.label ?? ctx.company.niche}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.title} href={c.href}>
              <Card className="transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-ink-faint">{c.title}</CardTitle>
                  <Icon className="h-4 w-4 text-ink-faint" />
                </div>
                <p className="mt-2 text-2xl font-bold text-ink">{c.value}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="mt-6 max-w-sm">
        <CardTitle className="text-ink-faint">Margem de lucro padrao</CardTitle>
        <p className="mt-2 text-2xl font-bold text-ink">
          {formatBps(company?.defaultMarginBps ?? 0)}
        </p>
        <Link href="/configuracoes" className="mt-1 inline-block text-sm text-brand">
          Ajustar em Configuracoes
        </Link>
      </Card>
    </>
  );
}
