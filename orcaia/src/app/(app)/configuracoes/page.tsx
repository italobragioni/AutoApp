import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { getNiche } from "@/lib/niches";
import { atLeast } from "@/lib/core/permissions";
import { bpsToInput, centsToInput } from "@/lib/core/money";
import {
  updateCompanyProfile,
  updatePricingDefaults,
  updateProfile,
  updatePassword,
  createCompany,
} from "@/app/actions/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import {
  CompanyProfileForm,
  PricingForm,
  AccountProfileForm,
  PasswordForm,
  NewCompanyForm,
} from "@/components/forms/SettingsForms";

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietario",
  manager: "Gerente",
  staff: "Colaborador",
};

export default async function ConfiguracoesPage() {
  const ctx = await requireContext();
  const canManage = atLeast(ctx.role, "manager");

  const company = await prisma.company.findUnique({
    where: { id: ctx.company.id },
    select: {
      name: true,
      niche: true,
      document: true,
      phone: true,
      email: true,
      city: true,
      state: true,
      address: true,
      defaultMarginBps: true,
      defaultLaborRateCents: true,
      memberships: {
        select: { role: true, user: { select: { name: true, email: true } } },
      },
    },
  });

  if (!company) return null;
  const niche = getNiche(company.niche);

  return (
    <>
      <PageHeader
        title="Configuracoes"
        description="Empresa, margem de lucro, seu perfil e usuarios."
      />

      <div className="space-y-6">
        {/* Empresa */}
        <Card>
          <CardTitle>Dados da empresa</CardTitle>
          <p className="mt-1 mb-4 text-sm text-ink-faint">
            Nicho: {niche?.label ?? company.niche}
          </p>
          {canManage ? (
            <CompanyProfileForm action={updateCompanyProfile} initial={company} />
          ) : (
            <p className="text-sm text-ink-faint">
              Apenas gerentes e o proprietario podem editar os dados da empresa.
            </p>
          )}
        </Card>

        {/* Margem / precos */}
        <Card>
          <CardTitle>Margem de lucro e mao de obra padrao</CardTitle>
          <p className="mt-1 mb-4 text-sm text-ink-faint">
            Valores padrao aplicados aos novos orcamentos.
          </p>
          {canManage ? (
            <PricingForm
              action={updatePricingDefaults}
              marginValue={bpsToInput(company.defaultMarginBps)}
              laborValue={
                company.defaultLaborRateCents ? centsToInput(company.defaultLaborRateCents) : ""
              }
            />
          ) : (
            <p className="text-sm text-ink-faint">
              Apenas gerentes e o proprietario podem editar as politicas de preco.
            </p>
          )}
        </Card>

        {/* Usuarios */}
        <Card>
          <CardTitle>Usuarios e acesso</CardTitle>
          <ul className="mt-3 space-y-2">
            {company.memberships.map((m, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg bg-surface-soft px-3 py-2 text-sm"
              >
                <span className="text-ink">
                  {m.user.name} <span className="text-ink-faint">({m.user.email})</span>
                </span>
                <span className="rounded bg-white px-2 py-0.5 text-xs text-ink-soft">
                  {ROLE_LABELS[m.role] ?? m.role}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Perfil + senha */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle>Meu perfil</CardTitle>
            <div className="mt-3">
              <AccountProfileForm action={updateProfile} name={ctx.user.name} />
            </div>
          </Card>
          <Card>
            <CardTitle>Alterar senha</CardTitle>
            <div className="mt-3">
              <PasswordForm action={updatePassword} />
            </div>
          </Card>
        </div>

        {/* Nova empresa (multiempresa) */}
        <Card>
          <CardTitle>Criar nova empresa</CardTitle>
          <p className="mt-1 mb-4 text-sm text-ink-faint">
            Voce pode gerenciar varias empresas na mesma conta e alternar entre elas
            pelo seletor no menu.
          </p>
          <div className="max-w-md">
            <NewCompanyForm action={createCompany} />
          </div>
        </Card>
      </div>
    </>
  );
}
