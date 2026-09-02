import type { Metadata } from "next";
import { Building2, Database, Repeat2, ShieldCheck, Users } from "lucide-react";

import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { PageHeader } from "@/components/ui/page";
import { contextWith } from "@/lib/authorize";
import { db } from "@/lib/db";
import { dateFull } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { ROLE_SUMMARY, type Role } from "@/lib/permissions";

import { CompanyForm, RetentionForm } from "./SettingsForms";
import { InviteMember, NewCompany, TeamList } from "./TeamPanel";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  // As duas permissoes que decidem o que esta pagina mostra. A checagem real de
  // cada acao acontece na propria action, no servidor.
  const { context, allowed } = await contextWith([
    "company.settings",
    "team.manage",
    "company.create",
  ]);
  const { company, user, role } = context;
  const canEdit = allowed["company.settings"];
  const canManageTeam = allowed["team.manage"];

  const [members, invitations, counts] = await Promise.all([
    db.membership.findMany({
      where: { companyId: company.id },
      include: { user: { select: { id: true, name: true, email: true, avatarColor: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // Convites pendentes só interessam a quem gerencia a equipe.
    canManageTeam
      ? db.invitation.findMany({
          where: { companyId: company.id, status: "pendente" },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    Promise.all([
      db.customer.count({ where: { companyId: company.id } }),
      db.vehicle.count({ where: { companyId: company.id } }),
      db.serviceItem.count({ where: { companyId: company.id } }),
      db.workOrder.count({ where: { companyId: company.id } }),
    ]),
  ]);

  const [customers, vehicles, services, orders] = counts;

  const teamMembers = members.map((member) => ({
    membershipId: member.id,
    userId: member.user.id,
    name: member.user.name,
    email: member.user.email,
    avatarColor: member.user.avatarColor,
    role: member.role,
    joinedAt: member.createdAt.toISOString(),
    isSelf: member.user.id === user.id,
  }));

  const now = new Date();
  const teamInvitations = invitations.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    token: invitation.token,
    expiresAt: invitation.expiresAt.toISOString(),
    expired: invitation.expiresAt < now,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Dados da empresa, regras de retenção e quem tem acesso à plataforma."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Dados da empresa e regras: so para quem tem company.settings. */}
          {canEdit ? (
            <>
              <Card>
                <CardHeader
                  title="Dados da empresa"
                  description="Aparecem em orçamentos e mensagens enviadas aos clientes."
                  action={<Badge tone="volt">{company.slug}</Badge>}
                />
                <CompanyForm company={company} />
              </Card>

              <Card>
                <CardHeader
                  title="Regras de retenção"
                  description="Definem quando um cliente entra em atenção, risco ou inatividade."
                  action={<Repeat2 size={16} className="text-volt-400" />}
                />
                <RetentionForm
                  retentionWindowDays={company.retentionWindowDays}
                  inactiveAfterDays={company.inactiveAfterDays}
                  contactCooldownDays={company.contactCooldownDays}
                  attributionWindowDays={company.attributionWindowDays}
                />
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader
                title="Configurações da empresa"
                description="Somente o proprietário altera dados da empresa e regras de retenção."
                action={<ShieldCheck size={16} className="text-muted" />}
              />
              <CardBody className="text-sm text-muted">
                Seu papel nesta empresa é{" "}
                <strong className="text-soft">{ROLE_LABEL[role] ?? role}</strong>. Fale com o
                proprietário se precisar alterar algo aqui.
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Equipe"
              description={
                canManageTeam
                  ? `${members.length} ${members.length === 1 ? "pessoa" : "pessoas"} com acesso${
                      teamInvitations.length > 0
                        ? ` · ${teamInvitations.length} convite(s) pendente(s)`
                        : ""
                    }.`
                  : `${members.length} ${members.length === 1 ? "pessoa" : "pessoas"} com acesso a esta empresa.`
              }
              action={
                canManageTeam ? <InviteMember /> : <Users size={16} className="text-muted" />
              }
            />
            <TeamList
              members={teamMembers}
              invitations={teamInvitations}
              canManage={canManageTeam}
            />
            {canManageTeam && (
              <p className="border-t border-line px-5 py-3.5 text-xs leading-relaxed text-muted">
                Convites valem por 7 dias e deixam de funcionar assim que aceitos. Remover alguém
                tira o acesso a esta empresa na hora — a conta e o histórico continuam.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Suas empresas" description="Alterne pelo seletor no topo." />
            <ul className="divide-y divide-line">
              {context.companies.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-volt-300">
                    <Building2 size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{item.name}</p>
                    <p className="text-xs text-muted">{ROLE_LABEL[item.role] ?? item.role}</p>
                  </div>
                  {item.id === company.id && <Badge tone="volt">Ativa</Badge>}
                </li>
              ))}
            </ul>
            {allowed["company.create"] && (
              <div className="border-t border-line">
                <NewCompany />
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Dados desta empresa"
              description="Volume armazenado no seu espaço isolado."
              action={<Database size={16} className="text-muted" />}
            />
            <CardBody className="space-y-3">
              {[
                { label: "Clientes", value: customers },
                { label: "Veículos", value: vehicles },
                { label: "Serviços no catálogo", value: services },
                { label: "Ordens de serviço", value: orders },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{row.label}</span>
                  <span className="font-medium text-white">{row.value}</span>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Seu acesso"
              action={<ShieldCheck size={16} className="text-volt-400" />}
            />
            <CardBody className="space-y-3 text-xs leading-relaxed text-muted">
              <p>
                Você entra nesta empresa como{" "}
                <strong className="text-soft">{ROLE_LABEL[role] ?? role}</strong>, desde{" "}
                {dateFull(
                  members.find((member) => member.user.id === user.id)?.createdAt ?? new Date(),
                )}
                . {ROLE_SUMMARY[role as Role]}
              </p>
              <p>
                Cada empresa tem seu próprio espaço. Toda consulta feita pela plataforma é filtrada
                pelo identificador da empresa ativa na sua sessão — clientes, veículos, agenda,
                orçamentos e ordens de serviço nunca cruzam entre empresas.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
