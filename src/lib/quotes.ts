/**
 * Regras financeiras do orcamento.
 *
 * Ficam aqui para o formulario, a pagina e as server actions usarem exatamente
 * o mesmo calculo — sem uma segunda logica financeira em paralelo.
 *
 * Tudo em centavos, inteiros. Nada de ponto flutuante em dinheiro.
 */

export type QuoteItemLike = { quantity: number; unitPriceCents: number };

/** Subtotal = soma de (quantidade x preco unitario). */
export function quoteSubtotalCents(items: QuoteItemLike[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
}

/**
 * Total = subtotal - desconto.
 *
 * O desconto do schema (`discountCents`) e um VALOR em centavos, nao um
 * percentual — nao existe campo de percentual no banco. O total nunca fica
 * negativo.
 */
export function quoteTotalCents(subtotalCents: number, discountCents: number) {
  return Math.max(0, subtotalCents - Math.max(0, discountCents));
}

/** Um orcamento esta vencido quando a validade ja passou. */
export function isExpired(validUntil: Date | null, now: Date = new Date()) {
  return validUntil !== null && validUntil < now;
}

/**
 * Estados em que os valores ainda podem ser alterados.
 * Aprovado, recusado e cancelado ficam travados ate alguem reabrir o orcamento.
 */
export const EDITABLE_QUOTE_STATUSES = ["rascunho", "enviado", "expirado"] as const;

export function isQuoteEditable(status: string) {
  return (EDITABLE_QUOTE_STATUSES as readonly string[]).includes(status);
}
