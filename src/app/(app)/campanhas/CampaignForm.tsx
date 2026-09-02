"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Users } from "lucide-react";

import { Badge, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useActionForm } from "@/components/ui/action-form";
import { Modal } from "@/components/ui/modal";
import {
  createCampaignAction,
  updateCampaignAction,
  type CampaignState,
} from "@/app/actions/campaigns";
import type { Tone } from "@/components/ui";
import { cn } from "@/lib/format";
import { CAMPAIGN_STATUS, CHANNEL_LABEL } from "@/lib/labels";

export type AudienceOption = { key: string; label: string; customerIds: string[] };

export type CampaignCustomer = {
  id: string;
  name: string;
  phone: string | null;
  /** Rotulo e tom do estagio ja resolvidos no servidor: este componente e
   *  client-side e nao pode importar o motor de retencao. */
  stageLabel: string;
  stageTone: Tone;
  vehicleLabel: string | null;
};

export type CampaignFormValues = {
  id: string;
  name: string;
  channel: string;
  audience: string;
  status: string;
  message: string;
  scheduledAt: string;
};

/** Status oferecidos na criacao. Os demais vem das ações da campanha. */
const EDITABLE_STATUSES = ["rascunho", "agendada"];

function Submit({ label, count }: { label: string; count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || count === 0} className="w-full sm:w-auto">
      {pending ? "Salvando..." : count === 0 ? "Selecione ao menos 1 cliente" : label}
    </Button>
  );
}

export function CampaignForm({
  open,
  campaign,
  audiences,
  customers,
  closeHref,
}: {
  open: boolean;
  campaign?: CampaignFormValues;
  audiences: AudienceOption[];
  customers: CampaignCustomer[];
  closeHref: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(campaign);

  const { state, onSubmit } = useActionForm<CampaignState>(
    isEdit ? updateCampaignAction : createCampaignAction,
    undefined,
  );

  const [values, setValues] = useState({
    name: campaign?.name ?? "",
    channel: campaign?.channel ?? "whatsapp",
    audience: campaign?.audience ?? audiences[0]?.key ?? "em_risco",
    status: campaign?.status ?? "rascunho",
    message: campaign?.message ?? "",
    scheduledAt: campaign?.scheduledAt ?? "",
  });

  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const audienceIds = useMemo(
    () => audiences.find((a) => a.key === values.audience)?.customerIds ?? [],
    [audiences, values.audience],
  );

  // Quem vai receber. Comeca com o público inteiro e o usuário pode tirar
  // alguém antes de salvar — sem mexer em nada da retenção do cliente.
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  // Trocar de público recomeça a seleção.
  useEffect(() => {
    setRemoved(new Set());
  }, [values.audience]);

  const selected = audienceIds.filter((id) => !removed.has(id));

  const set = (field: keyof typeof values) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setValues((current) => ({ ...current, [field]: event.target.value }));

  function toggle(id: string) {
    setRemoved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (!state?.ok) return;
    router.replace(state.id ? `/campanhas/${state.id}` : closeHref);
    router.refresh();
  }, [state, router, closeHref]);

  function close() {
    router.replace(closeHref);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? "Editar campanha" : "Nova campanha"}
      description={
        isEdit
          ? "Os participantes já registrados não mudam ao editar a campanha."
          : "Escolha o público, revise quem entra e escreva a mensagem."
      }
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4 p-5" id="campaign-form">
        {isEdit && <input type="hidden" name="id" value={campaign!.id} />}
        {!isEdit &&
          selected.map((id) => (
            <input key={id} type="hidden" name="customerIds" value={id} />
          ))}

        {state?.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {state.error}
          </p>
        )}

        <Field label="Nome da campanha">
          <Input
            name="name"
            required
            maxLength={120}
            value={values.name}
            onChange={set("name")}
            placeholder="Ex.: Volta pra casa — clientes em risco"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Público-alvo" hint="Calculado agora, a partir do histórico real.">
            <Select name="audience" value={values.audience} onChange={set("audience")}>
              {audiences.map((audience) => (
                <option key={audience.key} value={audience.key}>
                  {audience.label} ({audience.customerIds.length})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Canal">
            <Select name="channel" value={values.channel} onChange={set("channel")}>
              {Object.entries(CHANNEL_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select name="status" value={values.status} onChange={set("status")}>
              {EDITABLE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {CAMPAIGN_STATUS[value].label}
                </option>
              ))}
              {isEdit && !EDITABLE_STATUSES.includes(values.status) && (
                <option value={values.status}>{CAMPAIGN_STATUS[values.status]?.label}</option>
              )}
            </Select>
          </Field>
          <Field label="Data programada" hint="Opcional. Não dispara nada sozinho.">
            <Input
              type="date"
              name="scheduledAt"
              value={values.scheduledAt}
              onChange={set("scheduledAt")}
            />
          </Field>
        </div>

        {/* Previa do publico: numeros reais, com remocao individual. */}
        {!isEdit && (
          <Field
            label={`Participantes (${selected.length} de ${audienceIds.length})`}
            hint="Desmarque quem não deve receber. Isso não altera a retenção do cliente."
          >
            {audienceIds.length === 0 ? (
              <p className="rounded-xl border border-line bg-ink-850 px-3.5 py-3 text-xs text-muted">
                Nenhum cliente neste público agora.
              </p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-ink-600 bg-ink-850 p-2">
                {audienceIds.map((id) => {
                  const customer = byId.get(id);
                  if (!customer) return null;
                  const checked = !removed.has(id);
                  return (
                    <label
                      key={id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        checked ? "bg-volt-400/10 text-white" : "text-muted",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(id)}
                        className="size-4 shrink-0 accent-volt-400"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {customer.name}
                        {customer.vehicleLabel && (
                          <span className="text-xs text-muted"> · {customer.vehicleLabel}</span>
                        )}
                      </span>
                      <Badge tone={customer.stageTone}>{customer.stageLabel}</Badge>
                    </label>
                  );
                })}
              </div>
            )}
          </Field>
        )}

        {isEdit && (
          <p className="flex items-start gap-2 rounded-xl border border-line bg-ink-850 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
            <Users size={14} className="mt-0.5 shrink-0 text-volt-400" />
            Os participantes foram congelados quando a campanha foi criada e não mudam ao editar —
            é isso que mantém a medição de conversão válida.
          </p>
        )}

        <Field
          label="Mensagem"
          hint="{nome} e {veiculo} são trocados pelos dados de cada cliente."
        >
          <Textarea
            name="message"
            required
            maxLength={2000}
            rows={4}
            value={values.message}
            onChange={set("message")}
            placeholder="Oi {nome}! Faz um tempo que o {veiculo} não passa aqui..."
          />
        </Field>

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={close} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Submit
            label={isEdit ? "Salvar alterações" : "Criar campanha"}
            count={isEdit ? 1 : selected.length}
          />
        </div>
      </form>
    </Modal>
  );
}
