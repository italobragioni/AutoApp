"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  Building2,
  Check,
  Copy,
  Link2,
  Mail,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

import { Avatar, Badge, Button, Field, Input, Select } from "@/components/ui";
import { useActionForm } from "@/components/ui/action-form";
import { Modal } from "@/components/ui/modal";
import {
  changeMemberRoleAction,
  createCompanyAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
  type TeamState,
} from "@/app/actions/team";
import { dateFull } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { ROLES, ROLE_SUMMARY, type Role } from "@/lib/permissions";

export type TeamMember = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  avatarColor: string;
  role: string;
  joinedAt: string;
  isSelf: boolean;
};

export type TeamInvitation = {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  expired: boolean;
};

/** O link do convite só existe no navegador: a origem vem de onde a pessoa está. */
function inviteUrl(token: string) {
  if (typeof window === "undefined") return `/convite/${token}`;
  return `${window.location.origin}/convite/${token}`;
}

function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(token);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de área de transferência: o campo ao lado continua
      // selecionável, então o link nunca fica inacessível.
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        data-invite-link
        onFocus={(event) => event.currentTarget.select()}
        className="focus-ring min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-xs text-soft"
      />
      <button
        type="button"
        onClick={copy}
        className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs font-medium text-soft transition-colors hover:text-white"
      >
        {copied ? <Check size={13} className="text-volt-300" /> : <Copy size={13} />}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Convidar                                                                    */
/* -------------------------------------------------------------------------- */

function InviteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Criando convite..." : "Criar convite"}
    </Button>
  );
}

export function InviteMember() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ email: "", role: "staff" });
  const { state, onSubmit } = useActionForm<TeamState>(inviteMemberAction, undefined);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  function close() {
    setOpen(false);
    setValues({ email: "", role: "staff" });
  }

  return (
    <>
      <Button type="button" size="md" onClick={() => setOpen(true)}>
        <UserPlus size={16} />
        Convidar
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Convidar para a equipe"
        description="O convite gera um link seguro, válido por 7 dias."
      >
        <form onSubmit={onSubmit} className="space-y-4 p-5" id="invite-form">
          {state?.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {state.error}
            </p>
          )}

          <Field label="E-mail">
            <Input
              type="email"
              name="email"
              required
              value={values.email}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              placeholder="pessoa@exemplo.com"
            />
          </Field>

          <Field label="Papel" hint={ROLE_SUMMARY[values.role as Role]}>
            <Select
              name="role"
              value={values.role}
              onChange={(e) => setValues((v) => ({ ...v, role: e.target.value }))}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </Select>
          </Field>

          {state?.ok && state.token ? (
            <div
              className="space-y-2 rounded-xl border border-volt-400/25 bg-volt-400/10 p-3.5"
              data-invite-created
            >
              <p className="flex items-center gap-2 text-xs font-semibold text-volt-200">
                <Link2 size={14} />
                Convite criado. Envie este link:
              </p>
              <CopyLink token={state.token} />
              <p className="text-[0.68rem] leading-relaxed text-muted">
                Quem abrir o link entra como{" "}
                <strong className="text-soft">{ROLE_LABEL[values.role]}</strong> nesta empresa. O
                envio automático por e-mail entra quando houver serviço de e-mail configurado.
              </p>
            </div>
          ) : (
            <p className="flex items-start gap-2 rounded-xl border border-line bg-ink-850 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
              <Mail size={14} className="mt-0.5 shrink-0" />
              Ainda não há serviço de e-mail configurado: o AUTOVOLT gera o link e você o envia
              como preferir.
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} className="w-full sm:w-auto">
              {state?.ok ? "Fechar" : "Cancelar"}
            </Button>
            <InviteButton />
          </div>
        </form>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Linha de membro: papel e remocao                                            */
/* -------------------------------------------------------------------------- */

function RoleSelect({ member }: { member: TeamMember }) {
  const router = useRouter();
  const { state, onSubmit } = useActionForm<TeamState>(changeMemberRoleAction, undefined);
  const [role, setRole] = useState(member.role);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  // Erro do servidor (último administrador, por exemplo): volta o seletor.
  useEffect(() => {
    if (state?.error) setRole(member.role);
  }, [state, member.role]);

  return (
    <form onSubmit={onSubmit} className="contents">
      <input type="hidden" name="membershipId" value={member.membershipId} />
      <input type="hidden" name="role" value={role} />
      <select
        aria-label={`Papel de ${member.name}`}
        value={role}
        onChange={(event) => {
          setRole(event.target.value);
          // Envia na hora: o formulário já carrega o novo valor.
          requestAnimationFrame(() => event.target.form?.requestSubmit());
        }}
        className="focus-ring rounded-lg border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-white"
      >
        {ROLES.map((option) => (
          <option key={option} value={option}>
            {ROLE_LABEL[option]}
          </option>
        ))}
      </select>
      {state?.error && (
        <span role="alert" className="block text-[0.68rem] text-rose-300">
          {state.error}
        </span>
      )}
    </form>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Removendo..." : "Remover da empresa"}
    </Button>
  );
}

function RemoveMember({ member }: { member: TeamMember }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { state, onSubmit } = useActionForm<TeamState>(removeMemberAction, undefined);

  useEffect(() => {
    if (!state?.ok) return;
    setOpen(false);
    router.refresh();
  }, [state, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Remover ${member.name}`}
        aria-label={`Remover ${member.name}`}
        className="focus-ring rounded-lg p-1.5 text-muted transition-colors hover:bg-rose-400/10 hover:text-rose-300"
      >
        <Trash2 size={14} />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Remover da equipe"
        description="A conta continua existindo — só o acesso a esta empresa é removido."
      >
        <form onSubmit={onSubmit} className="space-y-4 p-5" id="remove-member-form">
          <input type="hidden" name="membershipId" value={member.membershipId} />

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
            Remover <strong className="text-white">{member.name}</strong> desta empresa?
          </p>
          <p className="text-xs leading-relaxed text-muted">
            O acesso é cortado na hora. Nada do que essa pessoa registrou é apagado, e o acesso
            dela a outras empresas não muda.
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
            <RemoveButton />
          </div>
        </form>
      </Modal>
    </>
  );
}

function RevokeInvite({ invitation }: { invitation: TeamInvitation }) {
  const router = useRouter();
  const { state, onSubmit } = useActionForm<TeamState>(revokeInvitationAction, undefined);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form onSubmit={onSubmit} className="contents">
      <input type="hidden" name="invitationId" value={invitation.id} />
      <button
        type="submit"
        title="Cancelar convite"
        aria-label={`Cancelar convite de ${invitation.email}`}
        className="focus-ring rounded-lg p-1.5 text-muted transition-colors hover:bg-rose-400/10 hover:text-rose-300"
      >
        <X size={14} />
      </button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Painel                                                                      */
/* -------------------------------------------------------------------------- */

export function TeamList({
  members,
  invitations,
  canManage,
}: {
  members: TeamMember[];
  invitations: TeamInvitation[];
  canManage: boolean;
}) {
  return (
    <div className="divide-y divide-line">
      {members.map((member) => (
        <div key={member.membershipId} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
          <Avatar name={member.name} color={member.avatarColor} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {member.name}
              {member.isSelf && (
                <span className="ml-2 text-xs font-normal text-muted">(você)</span>
              )}
            </p>
            <p className="truncate text-xs text-muted">{member.email}</p>
          </div>

          <span className="text-xs text-muted">desde {dateFull(member.joinedAt)}</span>
          <Badge tone="success" dot>
            Ativo
          </Badge>

          {canManage && !member.isSelf ? (
            <div className="flex items-center gap-2">
              <RoleSelect member={member} />
              <RemoveMember member={member} />
            </div>
          ) : (
            <Badge tone={member.role === "owner" ? "volt" : "neutral"}>
              {ROLE_LABEL[member.role] ?? member.role}
            </Badge>
          )}
        </div>
      ))}

      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="flex flex-wrap items-center gap-3 px-5 py-3.5"
          data-invitation
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-muted">
            <Mail size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-soft">{invitation.email}</p>
            <p className="truncate text-xs text-muted">
              {invitation.expired
                ? `Expirou em ${dateFull(invitation.expiresAt)}`
                : `Válido até ${dateFull(invitation.expiresAt)}`}
            </p>
          </div>

          <Badge tone={invitation.expired ? "muted" : "warning"} dot>
            {invitation.expired ? "Convite expirado" : "Convite pendente"}
          </Badge>
          <Badge tone="neutral">{ROLE_LABEL[invitation.role] ?? invitation.role}</Badge>

          {canManage && (
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {!invitation.expired && (
                <div className="min-w-0 flex-1 sm:w-72">
                  <CopyLink token={invitation.token} />
                </div>
              )}
              <RevokeInvite invitation={invitation} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Nova empresa                                                                */
/* -------------------------------------------------------------------------- */

function CreateCompanyButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Criando..." : "Criar empresa"}
    </Button>
  );
}

export function NewCompany() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { state, onSubmit } = useActionForm<TeamState>(createCompanyAction, undefined);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-ink-850"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-volt-400/10 text-volt-300">
          <Building2 size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-white">Criar nova empresa</span>
          <span className="block text-xs text-muted">
            Começa vazia, sem nenhum dado desta.
          </span>
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Criar nova empresa"
        description="Você entra como proprietário e a plataforma passa a operar nela."
      >
        <form onSubmit={onSubmit} className="space-y-4 p-5" id="new-company-form">
          {state?.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {state.error}
            </p>
          )}

          <Field label="Nome da empresa">
            <Input
              name="name"
              required
              minLength={2}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Garage 77 — Unidade Centro"
            />
          </Field>

          <p className="text-xs leading-relaxed text-muted">
            Nenhum cliente, veículo ou ordem de serviço é copiado. As duas empresas continuam
            completamente separadas.
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
            <CreateCompanyButton />
          </div>
        </form>
      </Modal>
    </>
  );
}
