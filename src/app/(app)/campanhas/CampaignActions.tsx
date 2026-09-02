"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  Archive,
  Ban,
  Check,
  CheckCheck,
  MessageCircle,
  Send,
  Trash2,
  UserMinus,
  X,
} from "lucide-react";

import { Button } from "@/components/ui";
import { useActionForm } from "@/components/ui/action-form";
import { Modal } from "@/components/ui/modal";
import {
  changeCampaignStatusAction,
  deleteCampaignAction,
  removeParticipantAction,
  sendCampaignAction,
  setParticipantStatusAction,
  type CampaignState,
} from "@/app/actions/campaigns";
import { cn } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/* Status da campanha                                                          */
/* -------------------------------------------------------------------------- */

const STATUS_ACTIONS: Record<
  string,
  { label: string; icon: typeof Check; tone: "volt" | "info" | "muted" | "danger" }
> = {
  rascunho: { label: "Voltar para rascunho", icon: Ban, tone: "muted" },
  pausada: { label: "Pausar", icon: Ban, tone: "muted" },
  enviada: { label: "Retomar", icon: Send, tone: "volt" },
  concluida: { label: "Concluir campanha", icon: CheckCheck, tone: "info" },
  arquivada: { label: "Arquivar", icon: Archive, tone: "muted" },
};

/** Proximos status coerentes com o ciclo da campanha. */
export function nextCampaignStatuses(current: string): string[] {
  switch (current) {
    case "rascunho":
    case "agendada":
      return ["arquivada"];
    case "enviada":
      return ["pausada", "concluida"];
    case "pausada":
      return ["enviada", "concluida"];
    case "concluida":
      return ["arquivada"];
    case "arquivada":
      return ["rascunho"];
    default:
      return [];
  }
}

function StatusButton({ status }: { status: string }) {
  const { pending } = useFormStatus();
  const meta = STATUS_ACTIONS[status] ?? { label: status, icon: Check, tone: "muted" as const };
  const Icon = meta.icon;
  const tone = {
    volt: "text-volt-300 hover:bg-volt-400/10",
    info: "text-sky-300 hover:bg-sky-400/10",
    muted: "text-muted hover:bg-ink-800 hover:text-soft",
    danger: "text-rose-300 hover:bg-rose-400/10",
  }[meta.tone];

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "focus-ring inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
        tone,
      )}
    >
      <Icon size={13} />
      {pending ? "..." : meta.label}
    </button>
  );
}

function OneStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const { state, onSubmit } = useActionForm<CampaignState>(changeCampaignStatusAction, undefined);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form onSubmit={onSubmit} className="contents">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <StatusButton status={status} />
      {state?.error && (
        <span role="alert" className="text-[0.68rem] text-rose-300">
          {state.error}
        </span>
      )}
    </form>
  );
}

export function CampaignStatusActions({
  campaign,
}: {
  campaign: { id: string; status: string };
}) {
  const options = nextCampaignStatuses(campaign.status);
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {options.map((status) => (
        <OneStatus key={status} id={campaign.id} status={status} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Registrar envio da campanha                                                 */
/* -------------------------------------------------------------------------- */

function SendButton({ pendingCount }: { pendingCount: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="md">
      <Send size={16} />
      {pending ? "Registrando..." : `Registrar envio (${pendingCount})`}
    </Button>
  );
}

/**
 * Registra que a campanha foi disparada.
 *
 * Nao existe disparo automatico: o botao apenas anota que o usuario enviou as
 * mensagens que ainda estavam pendentes. E essa data que abre a janela de
 * atribuicao de cada participante.
 */
export function SendCampaign({
  campaign,
  pendingCount,
}: {
  campaign: { id: string };
  pendingCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { state, onSubmit } = useActionForm<CampaignState>(sendCampaignAction, undefined);

  useEffect(() => {
    if (!state?.ok) return;
    setOpen(false);
    router.refresh();
  }, [state, router]);

  if (pendingCount === 0) return null;

  return (
    <>
      <Button type="button" size="md" onClick={() => setOpen(true)}>
        <Send size={16} />
        Registrar envio
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar envio da campanha"
        description="O AUTOVOLT não dispara mensagens: isto apenas registra o que você enviou."
      >
        <form onSubmit={onSubmit} className="space-y-4 p-5" id="send-campaign-form">
          <input type="hidden" name="id" value={campaign.id} />

          {state?.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {state.error}
            </p>
          )}

          <p className="text-sm text-soft">
            Marcar <strong className="text-white">{pendingCount}</strong>{" "}
            {pendingCount === 1 ? "participante pendente" : "participantes pendentes"} como
            enviados a partir de agora?
          </p>
          <p className="text-xs leading-relaxed text-muted">
            Quem você já marcou como &quot;não enviado&quot; continua de fora, e quem já recebeu
            mantém a data original — a janela de atribuição de cada um não é reiniciada.
          </p>

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <SendButton pendingCount={pendingCount} />
          </div>
        </form>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Marcacao individual do participante                                         */
/* -------------------------------------------------------------------------- */

const PARTICIPANT_ACTIONS: Record<string, { label: string; icon: typeof Check }> = {
  enviado: { label: "Enviado", icon: Send },
  nao_enviado: { label: "Não enviado", icon: X },
  respondeu: { label: "Respondeu", icon: MessageCircle },
  sem_resposta: { label: "Sem resposta", icon: Ban },
};

function MarkButton({ status, active }: { status: string; active: boolean }) {
  const { pending } = useFormStatus();
  const meta = PARTICIPANT_ACTIONS[status];
  const Icon = meta.icon;

  return (
    <button
      type="submit"
      disabled={pending}
      title={meta.label}
      aria-label={meta.label}
      className={cn(
        "focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.68rem] font-medium transition-colors disabled:opacity-60",
        active
          ? "bg-volt-400/15 text-volt-200 ring-1 ring-inset ring-volt-400/30"
          : "text-muted hover:bg-ink-800 hover:text-soft",
      )}
    >
      <Icon size={12} />
      {pending ? "..." : meta.label}
    </button>
  );
}

function OneMark({
  participantId,
  status,
  active,
}: {
  participantId: string;
  status: string;
  active: boolean;
}) {
  const router = useRouter();
  const { state, onSubmit } = useActionForm<CampaignState>(
    setParticipantStatusAction,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form onSubmit={onSubmit} className="contents">
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="status" value={status} />
      <MarkButton status={status} active={active} />
      {state?.error && (
        <span role="alert" className="text-[0.68rem] text-rose-300">
          {state.error}
        </span>
      )}
    </form>
  );
}

export function ParticipantActions({
  participant,
}: {
  participant: { id: string; status: string };
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {Object.keys(PARTICIPANT_ACTIONS).map((status) => (
        <OneMark
          key={status}
          participantId={participant.id}
          status={status}
          active={participant.status === status}
        />
      ))}
    </div>
  );
}

/** Tira o participante da campanha. */
export function RemoveParticipant({ participant }: { participant: { id: string } }) {
  const router = useRouter();
  const { state, onSubmit } = useActionForm<CampaignState>(removeParticipantAction, undefined);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form onSubmit={onSubmit} className="contents">
      <input type="hidden" name="participantId" value={participant.id} />
      <button
        type="submit"
        title="Remover da campanha"
        aria-label="Remover da campanha"
        className="focus-ring rounded-lg p-1.5 text-muted transition-colors hover:bg-rose-400/10 hover:text-rose-300"
      >
        <UserMinus size={13} />
      </button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Exclusao                                                                    */
/* -------------------------------------------------------------------------- */

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Excluindo..." : "Excluir campanha"}
    </Button>
  );
}

export function DeleteCampaign({ campaign }: { campaign: { id: string; name: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { state, onSubmit } = useActionForm<CampaignState>(deleteCampaignAction, undefined);

  useEffect(() => {
    if (!state?.ok) return;
    router.replace("/campanhas");
    router.refresh();
  }, [state, router]);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="md"
        onClick={() => setOpen(true)}
        className="text-rose-300 hover:text-rose-200"
      >
        <Trash2 size={16} />
        Excluir
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Excluir campanha"
        description="Esta ação não pode ser desfeita."
      >
        <form onSubmit={onSubmit} className="space-y-4 p-5" id="delete-campaign-form">
          <input type="hidden" name="id" value={campaign.id} />

          {state?.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {state.error}
            </p>
          )}

          <p className="text-sm text-soft">
            Excluir <strong className="text-white">{campaign.name}</strong>?
          </p>
          <p className="text-xs leading-relaxed text-muted">
            Os participantes e as conversões registradas nesta campanha são apagados junto. As
            ordens de serviço não são afetadas.
          </p>

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <DeleteButton />
          </div>
        </form>
      </Modal>
    </>
  );
}
