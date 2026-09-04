/**
 * Catalogo de planos do AUTOVOLT — fonte unica de verdade.
 *
 * O valor e o identificador do produto na Cakto NAO ficam espalhados pelo
 * codigo: moram aqui, lidos de variaveis de ambiente. Trocar de produto, mudar
 * o preco exibido ou ligar um plano novo e mexer neste arquivo (e no .env), sem
 * caca a numeros soltos em telas e actions.
 *
 * Esta primeira versao tem um unico plano (PROFESSIONAL), mensal recorrente. A
 * estrutura ja e uma lista para que um segundo plano seja so mais uma entrada —
 * nenhuma tela precisa ser refeita.
 *
 * Este modulo e puro: nao toca banco nem sessao, entao serve tanto ao servidor
 * quanto a componentes que so precisam mostrar nome e preco.
 */

export type PlanId = "professional";
export type BillingInterval = "monthly";

export type Plan = {
  id: PlanId;
  name: string;
  /** Frase curta para a tela de assinatura. */
  tagline: string;
  interval: BillingInterval;
  /** Preco em centavos, para formatar em BRL sem erro de float. */
  priceCents: number;
  /** Id do produto na Cakto. Nulo quando o ambiente ainda nao configurou. */
  caktoProductId: string | null;
  /**
   * URL base do checkout hospedado da Cakto para este produto
   * (ex.: https://pay.cakto.com.br/xxxxxxx). Nula quando nao configurada — a
   * tela mostra o plano, mas o botao de assinar fica indisponivel ate configurar.
   */
  checkoutBaseUrl: string | null;
};

/** Le um inteiro de env com valor padrao — nunca deixa o preco "quebrar" a tela. */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function envStr(name: string): string | null {
  const raw = process.env[name]?.trim();
  return raw ? raw : null;
}

/**
 * A definicao de cada plano. Lida das envs no momento da chamada (nao no topo do
 * modulo) para que os testes e o servidor peguem sempre o valor atual.
 */
export function getPlans(): Plan[] {
  return [
    {
      id: "professional",
      name: "AUTOVOLT Profissional",
      tagline: "Tudo que a operação precisa para organizar e fazer o cliente voltar.",
      interval: "monthly",
      priceCents: envInt("CAKTO_PRICE_PROFESSIONAL_CENTS", 0),
      caktoProductId: envStr("CAKTO_PRODUCT_ID_PROFESSIONAL"),
      checkoutBaseUrl: envStr("CAKTO_CHECKOUT_URL_PROFESSIONAL"),
    },
  ];
}

export const DEFAULT_PLAN_ID: PlanId = "professional";

export function getPlan(id: string): Plan | undefined {
  return getPlans().find((plan) => plan.id === id);
}

/** O plano padrao — sempre existe. Usado quando ainda nao ha assinatura. */
export function defaultPlan(): Plan {
  const plan = getPlan(DEFAULT_PLAN_ID);
  if (!plan) throw new Error("Plano padrão ausente do catálogo.");
  return plan;
}

export const INTERVAL_LABEL: Record<BillingInterval, string> = {
  monthly: "Mensal",
};
