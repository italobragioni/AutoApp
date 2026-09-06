import type { Metadata } from "next";
import { MessageCircle, ShieldCheck } from "lucide-react";

import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { PageHeader } from "@/components/ui/page";
import { requirePermission } from "@/lib/authorize";
import { db } from "@/lib/db";
import { maskPhone } from "@/lib/whatsapp/phone";
import { getWhatsAppStats } from "@/lib/whatsapp/stats";

import {
  ConnectButton,
  ConnectedActions,
  HistoryTable,
  SettingsForm,
  type HistoryRow,
} from "./WhatsAppClient";

export const metadata: Metadata = { title: "WhatsApp Automático" };

export default async function WhatsAppPage() {
  const { company } = await requirePermission("whatsapp.manage");

  const [integration, settings, messages, stats] = await Promise.all([
    db.whatsAppIntegration.findUnique({ where: { companyId: company.id } }),
    db.whatsAppAutomationSettings.findUnique({ where: { companyId: company.id } }),
    db.whatsAppMessage.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { customer: { select: { name: true } } },
    }),
    getWhatsAppStats(company.id, company.attributionWindowDays),
  ]);

  const connected = integration?.status === "connected";

  const rows: HistoryRow[] = messages.map((m) => ({
    id: m.id,
    customerName: m.customer.name,
    phoneMasked: maskPhone(m.toPhone),
    automationType: m.automationType,
    status: m.status,
    content: m.content,
    error: m.error,
    createdAt: m.createdAt.toISOString(),
  }));

  const s = {
    enabled: settings?.enabled ?? true,
    retentionRiskEnabled: settings?.retentionRiskEnabled ?? true,
    retentionInactiveEnabled: settings?.retentionInactiveEnabled ?? true,
    appointmentReminderEnabled: settings?.appointmentReminderEnabled ?? true,
    postServiceEnabled: settings?.postServiceEnabled ?? true,
    timezone: settings?.timezone ?? "America/Sao_Paulo",
    riskTemplate: settings?.riskTemplate ?? "",
    inactiveTemplate: settings?.inactiveTemplate ?? "",
    reminderTemplate: settings?.reminderTemplate ?? "",
    postServiceTemplate: settings?.postServiceTemplate ?? "",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Crescimento"
        title="WhatsApp Automático"
        description="Conecte seu WhatsApp uma vez e deixe o AUTOVOLT trabalhar automaticamente."
      />

      {!connected ? (
        // ---------------------------------------------------------- Tela 1
        <Card>
          <CardBody className="flex flex-col items-start gap-5 p-6 sm:p-8">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-volt-400/12 text-volt-300">
              <MessageCircle size={24} />
            </span>
            <div className="max-w-xl">
              <h2 className="font-display text-xl font-bold text-white sm:text-2xl">
                Conecte seu WhatsApp e deixe o AUTOVOLT trabalhar automaticamente.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                O AUTOVOLT identifica clientes que precisam voltar, lembra seus agendamentos e
                mantém o relacionamento com seus clientes — sem você criar nenhuma automação.
              </p>
            </div>
            <ConnectButton />
            <p className="rounded-xl border border-line bg-ink-900/60 px-4 py-3 text-xs leading-relaxed text-muted">
              A conexão real por QR Code (via provedor externo) será ativada em breve. Por enquanto,
              o botão conecta em <strong className="text-soft">modo simulação</strong>: as automações
              rodam e você vê exatamente as mensagens que seriam enviadas — sem enviar nada de
              verdade.
            </p>
          </CardBody>
        </Card>
      ) : (
        // ---------------------------------------------------------- Tela 2
        <>
          <Card className="border-volt-400/25">
            <CardBody className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-3 shrink-0 items-center justify-center">
                  <span className="size-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,.18)]" />
                </span>
                <div>
                  <p className="flex items-center gap-2 font-semibold text-white">
                    WhatsApp conectado
                    <Badge tone="muted">simulação</Badge>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {company.name}
                    {integration?.phoneNumber ? ` · ${integration.phoneNumber}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-volt-200">
                    O AUTOVOLT está trabalhando automaticamente para você.
                  </p>
                </div>
              </div>
              <ConnectedActions />
            </CardBody>
          </Card>

          {/* Estatisticas */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Processadas hoje" value={stats.today.processed} />
            <Stat label="Enviadas hoje" value={stats.today.sent} tone="volt" />
            <Stat label="Falhas hoje" value={stats.today.failed} tone={stats.today.failed ? "danger" : undefined} />
            <Stat label="Clientes contatados (mês)" value={stats.period.contactedCustomers} />
            <Stat label="Lembretes (mês)" value={stats.period.remindersSent} />
            <Stat label="Retenção (mês)" value={stats.period.retentionSent} />
            <Stat label="Pós-serviço (mês)" value={stats.period.postServiceSent} />
            <Stat label="Clientes recuperados" value={stats.recoveredCustomers} tone="volt" />
          </div>
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Configuracoes */}
        <div className="min-w-0 lg:col-span-2">
          <Card>
            <CardHeader
              title="Configurações"
              description="Ligue o que quiser. As mensagens padrão já funcionam."
              action={<ShieldCheck size={16} className="text-volt-400" />}
            />
            <CardBody>
              <SettingsForm {...s} />
            </CardBody>
          </Card>
        </div>

        {/* Historico */}
        <div className="min-w-0 lg:col-span-3">
          <Card>
            <CardHeader
              title="Histórico"
              description="As mensagens que o AUTOVOLT enviou (ou simulou)."
            />
            <CardBody>
              <HistoryTable rows={rows} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "volt" | "danger";
}) {
  const color = tone === "volt" ? "text-volt-300" : tone === "danger" ? "text-rose-300" : "text-white";
  return (
    <div className="surface min-w-0 p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
