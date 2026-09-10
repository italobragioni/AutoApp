/**
 * Constantes públicas do site (landing, rodapé, termos, privacidade).
 *
 * Fonte única para preço e dados da empresa. Onde o dado real ainda não existe,
 * fica um placeholder entre colchetes — NUNCA um dado falso (CNPJ, telefone,
 * etc.). Para publicar de verdade, preencha os campos marcados abaixo e o
 * rodapé + as páginas de Termos/Privacidade se atualizam sozinhos.
 *
 * `PENDING` marca o que falta preencher; a UI mostra esses valores como
 * "a preencher" em vez de inventar.
 */

const PENDING = "";

export const SITE = {
  brand: "AUTOVOLT",
  tagline: "Sistema para estética automotiva",

  // Oferta (verdadeira e definida pelo dono).
  price: "R$47",
  priceMonthly: "R$47/mês",
  ctaLabel: "Começar agora — R$47/mês",
  signupHref: "/cadastro",

  // Dados legais/contato — PREENCHER antes de publicar. Vazio = "a preencher".
  legalName: PENDING, // Razão social (controlador na LGPD)
  cnpj: PENDING, // 00.000.000/0001-00
  supportWhatsapp: PENDING, // só dígitos com DDI, ex.: 5511999998888 (para wa.me)
  supportEmail: PENDING, // contato@suaempresa.com.br
  cityUf: PENDING, // Cidade/UF
} as const;

/** Rótulo para exibir um dado que ainda não foi preenchido. */
export function orPending(value: string, label: string): string {
  return value.trim() ? value : `[a preencher: ${label}]`;
}

/** Link wa.me quando houver número; senão null. */
export function whatsappLink(message = "Olá! Vim pelo site do AUTOVOLT."): string | null {
  const digits = SITE.supportWhatsapp.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Data da última atualização dos documentos legais (pt-BR). */
export const LEGAL_UPDATED_AT = "10 de setembro de 2026";
