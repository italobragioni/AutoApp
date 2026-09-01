import type { Metadata } from "next";
import { Building2, Database, Repeat2, ShieldCheck, Users } from "lucide-react";

import { Avatar, Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { PageHeader } from "@/components/ui/page";
import { db } from "@/lib/db";
import { dateFull } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { requireContext } from "@/lib/tenant";

import { CompanyForm, RetentionForm } from "./SettingsForms";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const context = await requireContext();
  const { company, user, role } = context;

  const [members, counts] = await Promise.all([
    db.membership.findMany({
      where: { companyId: company.id },
      include: { user: { select: { id: true, name: true, email: true, avatarColor: true } } },
      orderBy: { createdAt: "asc" },
    }),
    Promise.all([
      db.customer.count({ where: { companyId: company.id } }),
      db.vehicle.count({ where: { companyId: company.id } }),
      db.serviceItem.count({ where: { companyId: company.id } }),
      db.workOrder.count({ where: { companyId: company.id } }),
    ]),
  ]);

  const [customers, vehicles, services, orders] = counts;
  const canEdit = role === "owner" || role === "manager";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Dados da empresa, regras de retenção e quem tem acesso à plataforma."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader
              title="Dados da empresa"
              description={
                canEdit
                  ? "Aparecem em orçamentos e mensagens enviadas aos clientes."
                  : "Somente proprietários e gerentes podem editar."
              }
              action={<Badge tone="volt">{company.slug}</Badge>}
            />
            {canEdit ? (
              <CompanyForm company={company} />
            ) : (
              <CardBody className="text-sm text-muted">
                Você não tem permissão para alterar os dados desta empresa.
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Regras de retenção"
              description="Definem quando um cliente entra em atenção, risco ou inatividade."
              action={<Repeat2 size={16} className="text-volt-400" />}
            />
            {canEdit ? (
              <RetentionForm
                retentionWindowDays={company.retentionWindowDays}
                inactiveAfterDays={company.inactiveAfterDays}
              />
            ) : (
              <CardBody className="text-sm text-muted">
                Ciclo de {company.retentionWindowDays} dias · inativo após {company.inactiveAfterDays} dias.
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Usuários com acesso"
              description={`${members.length} ${members.length === 1 ? "pessoa" : "pessoas"} nesta empresa.`}
              action={<Users size={16} className="text-muted" />}
            />
            <ul className="divide-y divide-line">
              {members.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={member.user.name} color={member.user.avatarColor} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {member.user.name}
                      {member.user.id === user.id && (
                        <span className="ml-2 text-xs font-normal text-muted">(você)</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">{member.user.email}</p>
                  </div>
                  <Badge tone={member.role === "owner" ? "volt" : "neutral"}>
                    {ROLE_LABEL[member.role] ?? member.role}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 py-3.5 text-xs text-muted">
              O convite de novos usuários por e-mail entra em uma próxima etapa. A estrutura de
              papéis e permissões já está pronta no banco.
            </p>
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
            <CardHeader title="Isolamento de dados" action={<ShieldCheck size={16} className="text-volt-400" />} />
            <CardBody className="space-y-3 text-xs leading-relaxed text-muted">
              <p>
                Cada empresa tem seu próprio espaço. Toda consulta feita pela plataforma é filtrada
                pelo identificador da empresa ativa na sua sessão — clientes, veículos, agenda,
                orçamentos e ordens de serviço nunca cruzam entre empresas.
              </p>
              <p>
                Seu acesso a esta empresa é o de{" "}
                <strong className="text-soft">{ROLE_LABEL[role] ?? role}</strong>, concedido em{" "}
                {dateFull(members.find((member) => member.user.id === user.id)?.createdAt ?? new Date())}.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
