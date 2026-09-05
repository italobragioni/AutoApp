import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/brand/Logo";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { dateFull, money } from "@/lib/format";
import { can } from "@/lib/permissions";
import { INTERVAL_LABEL, defaultPlan, getPlan } from "@/lib/plans";
import {
  STATUS_LABEL,
  getSubscription,
  hasOperationalAccess,
  type SubscriptionStatus,
} from "@/lib/subscription";
import { requireContext } from "@/lib/tenant";

import { SignupTracker } from "@/components/analytics/SignupTracker";

import { ConfirmingPayment, SubscribeButton } from "./SubscribePanel";

export const metadata: Metadata = { title: "Assinatura" };

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "muted"> = {
  active: "success",
  pending: "warning",
  past_due: "danger",
  canceled: "muted",
  expired: "danger",
};

/**
 * Tela de assinatura. Fica FORA da area logada operacional de proposito: e o
 * destino de quem ainda nao tem acesso, entao nao pode depender do shell que
 * exige assinatura ativa. Continua exigindo login (requireContext + middleware).
 */
export default async function AssinaturaPage({
  searchParams,
}: {
  searchParams: Promise<{ retorno?: string; bemvindo?: string }>;
}) {
  const { retorno, bemvindo } = await searchParams;
  const context = await requireContext();
  const { company, role, user } = context;

  const subscription = await getSubscription(company.id);
  const hasAccess = hasOperationalAccess(subscription);
  const canManage = can(role, "billing.manage");

  const plan = getPlan(subscription?.plan ?? "") ?? defaultPlan();
  const status = (subscription?.status ?? "pending") as SubscriptionStatus;
  // Valor rastreado (Meta) segue o preço do plano; 47.00 como padrão se não
  // configurado. O checkout só pode iniciar se a URL da Cakto estiver definida.
  const trackedValue = plan.priceCents > 0 ? plan.priceCents / 100 : 47;
  const canCheckout = Boolean(plan.checkoutBaseUrl);
  const voltandoDoCheckout = retorno === "1";

  return (
    <div className="glow-top min-h-dvh">
      {/* Meta Pixel: dispara CompleteRegistration uma vez após o cadastro. */}
      <SignupTracker fire={bemvindo === "1"} />

      {/* Topo minimo: identidade + trocar de conta. */}
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-8">
          <Logo size={30} />
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:inline">{user.email}</span>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-volt-400">
            {company.name}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">Assinatura</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            O AUTOVOLT é uma plataforma por assinatura. Para usar o sistema operacional desta
            empresa — clientes, agenda, ordens de serviço e relatórios — é preciso ter uma
            assinatura ativa.
          </p>
        </div>

        {/* Já tem acesso: confirma e oferece a volta ao painel. */}
        {hasAccess && (
          <Card className="mb-6 border-volt-400/25">
            <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-volt-300" />
                <div>
                  <p className="font-medium text-white">Sua assinatura está ativa.</p>
                  <p className="mt-1 text-sm text-muted">Você já pode operar normalmente.</p>
                </div>
              </div>
              <Link
                href="/dashboard"
                className="focus-ring inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-volt-400 px-5 text-sm font-semibold text-ink-950 shadow-volt transition-colors hover:bg-volt-300"
              >
                Ir para o painel
                <ArrowRight size={16} />
              </Link>
            </CardBody>
          </Card>
        )}

        {/* Confirmando pagamento (voltou do checkout antes do webhook). */}
        {!hasAccess && voltandoDoCheckout && (
          <div className="mb-6">
            <ConfirmingPayment />
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-5">
          {/* Plano */}
          <Card className="lg:col-span-3">
            <CardHeader
              title={plan.name}
              description={plan.tagline}
              action={<Badge tone="volt">{INTERVAL_LABEL[plan.interval]}</Badge>}
            />
            <CardBody className="space-y-5">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-bold text-white">
                  {plan.priceCents > 0 ? money(plan.priceCents) : "—"}
                </span>
                <span className="text-sm text-muted">/mês</span>
              </div>

              <ul className="space-y-2.5">
                {[
                  "Clientes, veículos, agenda e ordens de serviço",
                  "Orçamentos e catálogo de serviços",
                  "Motor de retenção e campanhas",
                  "Relatórios financeiros e exportação",
                  "Equipe com papéis e permissões",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-soft">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-volt-400" />
                    {item}
                  </li>
                ))}
              </ul>

              {/* CTA: so quando nao ha acesso e quem pode contratar. */}
              {!hasAccess &&
                (canManage ? (
                  <div className="pt-1">
                    <SubscribeButton
                      planId={plan.id}
                      label={status === "pending" ? "Assinar agora" : "Regularizar assinatura"}
                      canCheckout={canCheckout}
                      value={trackedValue}
                    />
                    <p className="mt-3 text-center text-xs text-muted">
                      Pagamento processado com segurança pela Cakto. O acesso é liberado assim que o
                      pagamento é confirmado.
                    </p>
                  </div>
                ) : (
                  <p className="rounded-xl border border-line bg-ink-900/60 px-4 py-3 text-sm text-muted">
                    Só o proprietário desta empresa pode contratar ou regularizar a assinatura. Peça
                    a ele para ativar o acesso.
                  </p>
                ))}
            </CardBody>
          </Card>

          {/* Situacao atual */}
          <Card className="lg:col-span-2">
            <CardHeader
              title="Situação atual"
              action={<ShieldCheck size={16} className="text-muted" />}
            />
            <CardBody className="space-y-3.5 text-sm">
              <Row label="Status">
                <Badge tone={STATUS_TONE[status] ?? "muted"}>
                  {STATUS_LABEL[status] ?? status}
                </Badge>
              </Row>
              <Row label="Plano">
                <span className="text-white">{plan.name}</span>
              </Row>
              <Row label="Periodicidade">
                <span className="text-white">{INTERVAL_LABEL[plan.interval]}</span>
              </Row>
              <Row label="Valor">
                <span className="text-white">
                  {plan.priceCents > 0 ? `${money(plan.priceCents)}/mês` : "A confirmar"}
                </span>
              </Row>
              <Row label="Próxima renovação">
                <span className="text-white">
                  {subscription?.currentPeriodEnd
                    ? dateFull(subscription.currentPeriodEnd)
                    : "—"}
                </span>
              </Row>
              {subscription?.canceledAt && (
                <Row label="Cancelada em">
                  <span className="text-white">{dateFull(subscription.canceledAt)}</span>
                </Row>
              )}

              <p className="border-t border-line pt-3.5 text-xs leading-relaxed text-muted">
                Seus dados — clientes, veículos, ordens de serviço e histórico — ficam preservados
                mesmo sem assinatura ativa. A assinatura controla apenas o acesso, nunca apaga nada.
              </p>
            </CardBody>
          </Card>
        </div>
      </main>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  );
}
