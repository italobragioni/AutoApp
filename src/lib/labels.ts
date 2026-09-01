import type { Tone } from "@/components/ui";

/** Rótulos e cores dos status usados nas telas. Fonte única de verdade. */

export const APPOINTMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  agendado: { label: "Agendado", tone: "neutral" },
  confirmado: { label: "Confirmado", tone: "info" },
  em_andamento: { label: "Em andamento", tone: "volt" },
  concluido: { label: "Concluído", tone: "success" },
  cancelado: { label: "Cancelado", tone: "muted" },
  nao_compareceu: { label: "Não compareceu", tone: "danger" },
};

export const QUOTE_STATUS: Record<string, { label: string; tone: Tone }> = {
  rascunho: { label: "Rascunho", tone: "muted" },
  enviado: { label: "Enviado", tone: "info" },
  aprovado: { label: "Aprovado", tone: "success" },
  recusado: { label: "Recusado", tone: "danger" },
  expirado: { label: "Expirado", tone: "warning" },
};

export const WORK_ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  aberta: { label: "Aberta", tone: "neutral" },
  em_andamento: { label: "Em andamento", tone: "volt" },
  aguardando_retirada: { label: "Aguardando retirada", tone: "warning" },
  concluida: { label: "Concluída", tone: "success" },
  cancelada: { label: "Cancelada", tone: "muted" },
};

export const CAMPAIGN_STATUS: Record<string, { label: string; tone: Tone }> = {
  rascunho: { label: "Rascunho", tone: "muted" },
  agendada: { label: "Agendada", tone: "info" },
  enviada: { label: "Enviada", tone: "success" },
  pausada: { label: "Pausada", tone: "warning" },
};

export const SERVICE_CATEGORY: Record<string, string> = {
  lavagem: "Lavagem",
  polimento: "Polimento",
  protecao: "Proteção",
  higienizacao: "Higienização",
  estetica: "Estética",
  outro: "Outro",
};

export const VEHICLE_SIZE: Record<string, string> = {
  pequeno: "Pequeno",
  medio: "Médio",
  grande: "Grande",
  suv: "SUV",
};

export const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "E-mail",
  instagram: "Instagram",
};

export const ORIGIN_LABEL: Record<string, string> = {
  indicacao: "Indicação",
  instagram: "Instagram",
  google: "Google",
  passagem: "Passagem",
  outro: "Outro",
};

export const ROLE_LABEL: Record<string, string> = {
  owner: "Proprietário",
  manager: "Gerente",
  staff: "Operacional",
};

export const PAYMENT_LABEL: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  credito: "Crédito",
  debito: "Débito",
  link: "Link de pagamento",
};

export function statusOf(
  map: Record<string, { label: string; tone: Tone }>,
  key: string,
): { label: string; tone: Tone } {
  return map[key] ?? { label: key, tone: "neutral" };
}
