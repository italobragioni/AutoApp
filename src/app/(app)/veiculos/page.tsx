import type { Metadata } from "next";
import Link from "next/link";
import { Car, CheckCircle2, Plus, Search } from "lucide-react";

import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { PageHeader, StatCard } from "@/components/ui/page";
import { db } from "@/lib/db";
import { dateFull, money, plateMask } from "@/lib/format";
import { VEHICLE_SIZE } from "@/lib/labels";
import { requireContext } from "@/lib/tenant";

import { VehicleForm } from "./VehicleForm";

export const metadata: Metadata = { title: "Veículos" };

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; novo?: string; excluido?: string }>;
}) {
  const { company } = await requireContext();
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const creating = params.novo === "1";

  const vehicles = await db.vehicle.findMany({
    where: {
      companyId: company.id,
      ...(query
        ? {
            OR: [
              { brand: { contains: query } },
              { model: { contains: query } },
              { plate: { contains: query } },
              { customer: { name: { contains: query } } },
            ],
          }
        : {}),
    },
    orderBy: [{ brand: "asc" }, { model: "asc" }],
    include: {
      customer: { select: { id: true, name: true } },
      workOrders: {
        where: { status: "concluida" },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true, totalCents: true },
      },
    },
  });

  const total = await db.vehicle.count({ where: { companyId: company.id } });

  // Opcoes do seletor: somente clientes desta empresa.
  const customers = await db.customer.findMany({
    where: { companyId: company.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Distribuicao por marca — ajuda a entender o perfil da carteira.
  const byBrand = new Map<string, number>();
  for (const vehicle of vehicles) {
    byBrand.set(vehicle.brand, (byBrand.get(vehicle.brand) ?? 0) + 1);
  }
  const topBrands = [...byBrand.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const premium = vehicles.filter((vehicle) => vehicle.size === "suv" || vehicle.size === "grande");

  return (
    <div className="space-y-6">
      <VehicleForm open={creating} customers={customers} closeHref="/veiculos" />

      <PageHeader
        eyebrow="Operação"
        title="Veículos"
        description="Cada carro com seu dono, porte e histórico — o serviço certo para cada perfil."
        actions={
          <ButtonLink href="/veiculos?novo=1" size="md">
            <Plus size={16} />
            Novo veículo
          </ButtonLink>
        }
      />

      {params.excluido === "1" && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-volt-400/25 bg-volt-400/10 px-3.5 py-3 text-sm text-volt-200"
        >
          <CheckCircle2 size={15} className="shrink-0" />
          Veículo excluído.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Veículos na base" value={total} hint="Todos os clientes" icon={<Car size={17} />} />
        <StatCard
          label="Marca mais frequente"
          value={topBrands[0]?.[0] ?? "—"}
          hint={topBrands[0] ? `${topBrands[0][1]} veículos` : "Sem dados"}
        />
        <StatCard
          label="SUVs e veículos grandes"
          value={premium.length}
          hint="Serviços de maior ticket"
          tone="volt"
        />
        <StatCard
          label="Sem serviço registrado"
          value={vehicles.filter((vehicle) => vehicle.workOrders.length === 0).length}
          hint="Oportunidade de primeiro atendimento"
          tone="warning"
        />
      </div>

      <Card>
        <div className="border-b border-line p-4">
          <form className="relative" action="/veiculos">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              name="q"
              defaultValue={query}
              placeholder="Buscar por marca, modelo, placa ou cliente..."
              className="pl-10"
              aria-label="Buscar veículos"
            />
          </form>
        </div>

        {vehicles.length === 0 ? (
          <EmptyState
            icon={<Car size={20} />}
            title={query ? "Nenhum veículo encontrado" : "Nenhum veículo cadastrado"}
            description={
              query
                ? `Sem resultados para "${query}".`
                : "Cadastre os veículos dos seus clientes para acompanhar o histórico por carro."
            }
            action={
              query ? (
                <ButtonLink href="/veiculos" size="sm" variant="secondary">
                  Limpar busca
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Veículo</Th>
                <Th>Placa</Th>
                <Th>Cliente</Th>
                <Th>Porte</Th>
                <Th>Último serviço</Th>
                <Th className="text-right">Gerou</Th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => {
                const revenue = vehicle.workOrders.reduce((sum, order) => sum + order.totalCents, 0);
                const last = vehicle.workOrders[0]?.finishedAt ?? null;
                return (
                  <Tr key={vehicle.id}>
                    <Td>
                      <Link
                        href={`/veiculos/${vehicle.id}`}
                        className="focus-ring flex items-center gap-3 rounded"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-volt-300">
                          <Car size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-white">
                            {vehicle.brand} {vehicle.model}
                          </span>
                          <span className="block text-xs text-muted">
                            {vehicle.year ?? "—"} · {vehicle.color ?? "cor não informada"}
                          </span>
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <span className="rounded-lg border border-line bg-ink-850 px-2 py-1 font-mono text-[0.72rem] text-soft">
                        {plateMask(vehicle.plate)}
                      </span>
                    </Td>
                    <Td>
                      <Link
                        href={`/clientes/${vehicle.customer.id}`}
                        className="focus-ring rounded text-sm text-soft hover:text-volt-300"
                      >
                        {vehicle.customer.name}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone={vehicle.size === "suv" || vehicle.size === "grande" ? "volt" : "neutral"}>
                        {VEHICLE_SIZE[vehicle.size] ?? vehicle.size}
                      </Badge>
                    </Td>
                    <Td className="text-sm text-soft">
                      {last ? dateFull(last) : <span className="text-muted">Nunca</span>}
                    </Td>
                    <Td className="text-right text-sm font-medium text-white">{money(revenue)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {topBrands.length > 0 && (
        <Card>
          <div className="border-b border-line px-5 py-4">
            <h3 className="text-sm font-semibold text-white">Marcas mais atendidas</h3>
            <p className="mt-1 text-xs text-muted">
              Ajuda a definir serviços e comunicação para o perfil da sua carteira.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 p-5">
            {topBrands.map(([brand, count]) => (
              <span
                key={brand}
                className="rounded-full border border-line bg-ink-850 px-3.5 py-1.5 text-xs text-soft"
              >
                {brand} <span className="ml-1 font-medium text-volt-300">{count}</span>
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
