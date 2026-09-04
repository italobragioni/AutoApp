/**
 * Autorizacao do AUTOVOLT — fonte unica de verdade.
 *
 * Os papeis ja existiam no schema (`Membership.role`) e continuam os mesmos:
 * owner, manager e staff — Proprietario, Gerente e Operacional (ROLE_LABEL em
 * src/lib/labels.ts). Nada de papel novo, nada de segunda estrutura.
 *
 * O que faltava era o meio do caminho. Ate aqui cada action repetia a mesma
 * linha solta (`if (role !== "owner" && role !== "manager")`), o que espalha a
 * regra por seis arquivos e deixa facil esquecer de aplicar em um deles. Agora
 * a regra mora neste mapa e todo mundo pergunta a ele.
 *
 * Este arquivo e puro de proposito (nao importa sessao nem banco): serve tanto
 * ao servidor quanto a componentes de cliente que precisem esconder um botao.
 * As travas que dependem de sessao ficam em src/lib/authorize.ts.
 */

export const ROLES = ["owner", "manager", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "customers.write",
  "customers.delete",
  "vehicles.write",
  "vehicles.delete",
  "services.write",
  "appointments.write",
  "quotes.write",
  /** Aprovar, recusar e converter em OS. */
  "quotes.decide",
  "workorders.write",
  /** Concluir e registrar pagamento. */
  "workorders.finish",
  "retention.contact",
  "campaigns.write",
  /** Ver faturamento, ticket medio e receita — os numeros do negocio. */
  "reports.finance",
  /** Dados da empresa e regras de retencao/campanha. */
  "company.settings",
  /** Convidar, alterar papel e remover pessoas. */
  "team.manage",
  "company.create",
  /** Ver planos, iniciar checkout e gerenciar a assinatura da empresa. */
  "billing.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * O que cada papel pode fazer.
 *
 * owner   — acesso total, incluindo empresa e equipe.
 * manager — operacao completa (inclusive orcamentos, campanhas e relatorios),
 *           mas sem tocar em configuracoes da empresa nem na equipe.
 * staff   — o dia a dia do atendimento: clientes, veiculos, agenda, ordens de
 *           servico e o registro de contato da retencao. Sem exclusoes, sem
 *           catalogo de servicos, sem orcamento, sem campanha e sem os numeros
 *           financeiros.
 */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  manager: [
    "customers.write",
    "customers.delete",
    "vehicles.write",
    "vehicles.delete",
    "services.write",
    "appointments.write",
    "quotes.write",
    "quotes.decide",
    "workorders.write",
    "workorders.finish",
    "retention.contact",
    "campaigns.write",
    "reports.finance",
  ],
  staff: [
    "customers.write",
    "vehicles.write",
    "appointments.write",
    "workorders.write",
    "workorders.finish",
    "retention.contact",
  ],
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** A pergunta que todo o resto do sistema faz. */
export function can(role: string, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Todas as permissoes de um papel — usado para descrever o acesso na tela. */
export function permissionsOf(role: string): readonly Permission[] {
  return isRole(role) ? ROLE_PERMISSIONS[role] : [];
}

/** Mensagem unica de recusa. */
export const DENIED = "Você não tem permissão para esta ação.";

/**
 * Resumo do que cada papel enxerga, para a tela de Equipe.
 * Texto curto, na linguagem de quem usa a plataforma.
 */
export const ROLE_SUMMARY: Record<Role, string> = {
  owner: "Acesso total, incluindo dados da empresa, equipe e convites.",
  manager: "Operação completa e relatórios. Não altera empresa nem equipe.",
  staff: "Clientes, veículos, agenda e ordens de serviço. Sem dados financeiros.",
};
