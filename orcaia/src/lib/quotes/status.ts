// Estados do orcamento — fonte unica (usada por actions, controles e documentos).

export const QUOTE_STATUSES = [
  "rascunho",
  "enviado",
  "em_negociacao",
  "aprovado",
  "recusado",
  "expirado",
  "cancelado",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  em_negociacao: "Em negociação",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  cancelado: "Cancelado",
};

// Opcoes oferecidas no seletor de status (as pedidas pelo produto).
export const QUOTE_STATUS_OPTIONS: [string, string][] = [
  ["rascunho", "Rascunho"],
  ["enviado", "Enviado"],
  ["em_negociacao", "Em negociação"],
  ["aprovado", "Aprovado"],
  ["recusado", "Recusado"],
  ["expirado", "Expirado"],
];

export function isQuoteStatus(v: string): v is QuoteStatus {
  return (QUOTE_STATUSES as readonly string[]).includes(v);
}

export function quoteStatusLabel(v: string): string {
  return QUOTE_STATUS_LABELS[v] ?? v;
}

// Cor (classes Tailwind) por status, para "badges".
export function quoteStatusBadge(v: string): string {
  switch (v) {
    case "aprovado":
      return "bg-emerald-50 text-emerald-700";
    case "enviado":
      return "bg-blue-50 text-blue-700";
    case "em_negociacao":
      return "bg-amber-50 text-amber-700";
    case "recusado":
      return "bg-red-50 text-red-700";
    case "expirado":
      return "bg-surface-soft text-ink-faint";
    case "cancelado":
      return "bg-surface-soft text-ink-faint";
    default:
      return "bg-brand-muted text-brand";
  }
}
