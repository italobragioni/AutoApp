"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Play, Plug, PowerOff, Save } from "lucide-react";

import { Badge, Button, Field, Input, Textarea } from "@/components/ui";
import {
  disconnectWhatsAppAction,
  runAutomationsNowAction,
  saveWhatsAppSettingsAction,
  simulateConnectAction,
  type WhatsAppState,
} from "@/app/actions/whatsapp";
import { AUTOMATION_LABEL, type AutomationType } from "@/lib/whatsapp/config";

const STATUS_LABEL: Record<string, string> = {
  sent: "Enviada",
  sending: "Enviando",
  queued: "Na fila",
  failed: "Falhou",
  skipped: "Ignorada",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "muted"> = {
  sent: "success",
  sending: "warning",
  queued: "muted",
  failed: "danger",
  skipped: "muted",
};

function Feedback({ state }: { state: WhatsAppState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p className="mt-2 flex items-start gap-2 text-sm text-rose-300">
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p className="mt-2 flex items-start gap-2 text-sm text-volt-300">
        <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
        {state.ok}
      </p>
    );
  }
  return null;
}

function SubmitButton({
  children,
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className}>
      {pending ? "Processando..." : children}
    </Button>
  );
}

/** Tela 1 — botão de conectar (simulação nesta fase). */
export function ConnectButton() {
  const [state, action] = useActionState(simulateConnectAction, undefined);
  return (
    <form action={action}>
      <SubmitButton className="w-full sm:w-auto">
        <Plug size={16} /> Conectar WhatsApp
      </SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

/** Tela 2 — executar agora + desconectar. */
export function ConnectedActions() {
  const [runState, runAction] = useActionState(runAutomationsNowAction, undefined);
  const [discState, discAction] = useActionState(disconnectWhatsAppAction, undefined);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <form action={runAction}>
          <SubmitButton>
            <Play size={16} /> Executar agora (simulação)
          </SubmitButton>
        </form>
        <form action={discAction}>
          <SubmitButton variant="secondary">
            <PowerOff size={16} /> Desconectar
          </SubmitButton>
        </form>
      </div>
      <Feedback state={runState} />
      <Feedback state={discState} />
    </div>
  );
}

type SettingsProps = {
  enabled: boolean;
  retentionRiskEnabled: boolean;
  retentionInactiveEnabled: boolean;
  appointmentReminderEnabled: boolean;
  postServiceEnabled: boolean;
  timezone: string;
  riskTemplate: string;
  inactiveTemplate: string;
  reminderTemplate: string;
  postServiceTemplate: string;
};

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-line bg-ink-900/40 px-4 py-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 accent-volt-400"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Configurações simples do WhatsApp Automático. */
export function SettingsForm(props: SettingsProps) {
  const [state, action] = useActionState<WhatsAppState, FormData>(
    saveWhatsAppSettingsAction,
    undefined,
  );
  const [showTemplates, setShowTemplates] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <Toggle
        name="enabled"
        label="WhatsApp Automático"
        hint="Interruptor geral. Desligado, nenhuma automação envia."
        defaultChecked={props.enabled}
      />

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Toggle
          name="retentionRiskEnabled"
          label="Clientes em risco"
          hint="Convida quem está atrasado no retorno."
          defaultChecked={props.retentionRiskEnabled}
        />
        <Toggle
          name="retentionInactiveEnabled"
          label="Clientes inativos"
          hint="Reativa quem sumiu há muito tempo."
          defaultChecked={props.retentionInactiveEnabled}
        />
        <Toggle
          name="appointmentReminderEnabled"
          label="Lembretes de agendamento"
          hint="Lembra o cliente ~24h antes."
          defaultChecked={props.appointmentReminderEnabled}
        />
        <Toggle
          name="postServiceEnabled"
          label="Pós-serviço"
          hint="Pergunta como ficou, dias após a OS."
          defaultChecked={props.postServiceEnabled}
        />
      </div>

      <Field label="Fuso horário" hint="Usado para respeitar o horário de envio.">
        <Input name="timezone" defaultValue={props.timezone} placeholder="America/Sao_Paulo" />
      </Field>

      <div>
        <button
          type="button"
          onClick={() => setShowTemplates((v) => !v)}
          className="focus-ring rounded text-sm font-medium text-volt-400 hover:text-volt-300"
        >
          {showTemplates ? "Ocultar" : "Personalizar mensagens (opcional)"}
        </button>
        {showTemplates && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted">
              Deixe em branco para usar o texto padrão. Variáveis:{" "}
              <code>{"{primeiro_nome} {veiculo} {empresa} {data} {horario}"}</code>
            </p>
            <Field label="Clientes em risco">
              <Textarea name="riskTemplate" rows={3} defaultValue={props.riskTemplate} />
            </Field>
            <Field label="Clientes inativos">
              <Textarea name="inactiveTemplate" rows={3} defaultValue={props.inactiveTemplate} />
            </Field>
            <Field label="Lembrete de agendamento">
              <Textarea name="reminderTemplate" rows={3} defaultValue={props.reminderTemplate} />
            </Field>
            <Field label="Pós-serviço">
              <Textarea name="postServiceTemplate" rows={3} defaultValue={props.postServiceTemplate} />
            </Field>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>
          <Save size={16} /> Salvar
        </SubmitButton>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export type HistoryRow = {
  id: string;
  customerName: string;
  phoneMasked: string;
  automationType: string;
  status: string;
  content: string;
  error: string | null;
  createdAt: string;
};

/** Histórico com filtros simples (em memória). */
export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  const [status, setStatus] = useState("todos");
  const [type, setType] = useState("todos");
  const [period, setPeriod] = useState("30");

  const filtered = useMemo(() => {
    const now = Date.now();
    const days = period === "todos" ? Infinity : Number(period);
    const since = now - days * 24 * 60 * 60 * 1000;
    return rows.filter((r) => {
      if (status !== "todos" && r.status !== status) return false;
      if (type !== "todos" && r.automationType !== type) return false;
      if (new Date(r.createdAt).getTime() < since) return false;
      return true;
    });
  }, [rows, status, type, period]);

  const select =
    "h-9 rounded-lg border border-line bg-ink-900 px-2.5 text-sm text-soft focus-ring";

  return (
    <div>
      <div className="flex flex-wrap gap-2 px-1 pb-3">
        <select className={select} value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="1">Hoje</option>
          <option value="7">7 dias</option>
          <option value="30">30 dias</option>
          <option value="todos">Tudo</option>
        </select>
        <select className={select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="sent">Enviadas</option>
          <option value="failed">Falhas</option>
          <option value="skipped">Ignoradas</option>
        </select>
        <select className={select} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="todos">Todas as automações</option>
          {(Object.keys(AUTOMATION_LABEL) as AutomationType[]).map((t) => (
            <option key={t} value={t}>
              {AUTOMATION_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted">
          Nenhuma mensagem no filtro selecionado.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {filtered.map((r) => (
            <li key={r.id} className="px-1 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{r.customerName}</span>
                  <span className="text-xs text-muted">{r.phoneMasked}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="muted">{AUTOMATION_LABEL[r.automationType as AutomationType] ?? r.automationType}</Badge>
                  <Badge tone={STATUS_TONE[r.status] ?? "muted"}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </div>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-soft">
                {r.content}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{new Date(r.createdAt).toLocaleString("pt-BR")}</span>
                {r.error && <span className="text-rose-300">· {r.error}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
