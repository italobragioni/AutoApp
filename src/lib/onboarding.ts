import "server-only";

import { db } from "@/lib/db";
import { can, type Permission } from "@/lib/permissions";
import type { CurrentContext } from "@/lib/tenant";

/**
 * Guia de primeiros passos.
 *
 * Cada etapa e concluida por DADO REAL, nunca por clique: a fonte da verdade e
 * o banco. `onboardingDismissedAt` da empresa apenas esconde o card — nao conta
 * como conclusao, e por isso vive separado daqui.
 *
 * Performance (requisito da fase): nada de carregar listas. A empresa ja veio
 * resolvida na sessao, entao a etapa "configurada" nao custa consulta; as
 * demais sao `count` com escopo por companyId — o Postgres responde na hora e
 * nenhuma linha e trazida para a aplicacao.
 *
 * Multiempresa: tudo recebe companyId e nada e memorizado entre empresas —
 * trocar de empresa recalcula do zero para a empresa atual.
 */

export type OnboardingStepKey =
  | "empresa"
  | "servico"
  | "cliente"
  | "veiculo"
  | "agendamento"
  | "ordem";

export type OnboardingStep = {
  key: OnboardingStepKey;
  title: string;
  description: string;
  /** Concluida com base no estado real da empresa. */
  done: boolean;
  /** Para onde o usuario vai ao clicar (abre o formulario correspondente). */
  href: string;
  /** Permissao necessaria para EXECUTAR a acao. Sem ela, a etapa nao e
   *  clicavel — mas continua sendo contada quando o dado ja existe. */
  permission: Permission;
};

export type Onboarding = {
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  /** Todas as etapas concluidas. */
  complete: boolean;
  /** O usuario dispensou o card desta empresa. */
  dismissed: boolean;
};

/**
 * A empresa esta "configurada" quando tem, alem do nome (obrigatorio no
 * cadastro), ao menos um meio de contato ou identificacao preenchido —
 * telefone, e-mail, documento ou endereco. Sao os campos que ja aparecem em
 * orcamentos e mensagens; nenhum campo novo foi criado para isto.
 */
export function companyConfigured(company: {
  phone: string | null;
  email: string | null;
  document: string | null;
  address: string | null;
}): boolean {
  return Boolean(
    company.phone?.trim() ||
      company.email?.trim() ||
      company.document?.trim() ||
      company.address?.trim(),
  );
}

/** Monta o guia para a empresa da sessao. */
export async function getOnboarding(context: CurrentContext): Promise<Onboarding> {
  const companyId = context.company.id;

  // `take: 1` via count: so precisamos saber se existe ao menos um.
  const [servicos, clientes, veiculos, agendamentos, ordens] = await Promise.all([
    db.serviceItem.count({ where: { companyId, active: true } }),
    db.customer.count({ where: { companyId } }),
    db.vehicle.count({ where: { companyId } }),
    db.appointment.count({ where: { companyId } }),
    db.workOrder.count({ where: { companyId } }),
  ]);

  const steps: OnboardingStep[] = [
    {
      key: "empresa",
      title: "Configure sua empresa",
      description: "Telefone, e-mail ou CNPJ — o que aparece nos seus orçamentos.",
      done: companyConfigured(context.company),
      href: "/configuracoes",
      permission: "company.settings",
    },
    {
      key: "servico",
      title: "Cadastre seu primeiro serviço",
      description: "Preço e duração do que você oferece.",
      done: servicos > 0,
      href: "/servicos?novo=1",
      permission: "services.write",
    },
    {
      key: "cliente",
      title: "Cadastre seu primeiro cliente",
      description: "Comece o histórico de quem você atende.",
      done: clientes > 0,
      href: "/clientes?novo=1",
      permission: "customers.write",
    },
    {
      key: "veiculo",
      title: "Cadastre o veículo do cliente",
      description: "Cada atendimento fica ligado a um carro.",
      done: veiculos > 0,
      href: "/veiculos?novo=1",
      permission: "vehicles.write",
    },
    {
      key: "agendamento",
      title: "Faça seu primeiro agendamento",
      description: "Organize a agenda da semana.",
      done: agendamentos > 0,
      href: "/agenda?novo=1",
      permission: "appointments.write",
    },
    {
      key: "ordem",
      title: "Crie sua primeira Ordem de Serviço",
      description: "Registre o serviço feito e o faturamento.",
      done: ordens > 0,
      href: "/ordens?nova=1",
      permission: "workorders.write",
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;

  return {
    steps,
    doneCount,
    total: steps.length,
    complete: doneCount === steps.length,
    dismissed: context.company.onboardingDismissedAt !== null,
  };
}

/** A etapa e clicavel para este papel? (o progresso independe disto.) */
export function canDoStep(role: string, step: OnboardingStep): boolean {
  return can(role, step.permission);
}
