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
  // O campo status e String livre; "cancelado" entra no mesmo conjunto, sem
  // criar uma segunda estrutura de status.
  cancelado: { label: "Cancelado", tone: "muted" },
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

/** Como o contato de retencao foi feito. */
export const CONTACT_CHANNEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  instagram: "Instagram",
  outro: "Outro",
};

/** No que o contato deu. Nao altera o estagio de retencao do cliente. */
export const CONTACT_OUTCOME: Record<string, { label: string; tone: Tone }> = {
  realizado: { label: "Contato realizado", tone: "neutral" },
  respondeu: { label: "Cliente respondeu", tone: "info" },
  sem_resposta: { label: "Sem resposta", tone: "muted" },
  sem_interesse: { label: "Não tem interesse", tone: "danger" },
  interessado: { label: "Interessado", tone: "volt" },
  agendou_retorno: { label: "Agendou retorno", tone: "success" },
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
