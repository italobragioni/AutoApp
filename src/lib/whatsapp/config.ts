/**
 * Configuração central do WhatsApp Automático.
 *
 * Regras (cooldown, janela de horário, antecedência do lembrete, atraso do
 * pós-serviço) ficam aqui, num lugar só — prontas para, no futuro, virarem
 * ajustáveis por empresa sem espalhar números pelo código.
 *
 * Módulo puro (sem banco/sessão): serve servidor e testes.
 */

export const AUTOMATION_TYPES = ["risco", "inativo", "lembrete", "pos_servico"] as const;
export type AutomationType = (typeof AUTOMATION_TYPES)[number];

export const AUTOMATION_LABEL: Record<AutomationType, string> = {
  risco: "Cliente em risco",
  inativo: "Cliente inativo",
  lembrete: "Lembrete de agendamento",
  pos_servico: "Pós-serviço",
};

/**
 * Cooldown por tipo (dias). O mesmo cliente não recebe o mesmo tipo de mensagem
 * antes de passar esse prazo. Lembrete e pós-serviço são presos ao evento
 * (agendamento/OS), então a idempotência por entidade já basta — cooldown 0.
 */
export const COOLDOWN_DAYS: Record<AutomationType, number> = {
  risco: 14,
  inativo: 30,
  lembrete: 0,
  pos_servico: 0,
};

/** Janela de horário permitida para envio (hora local da empresa). */
export const SEND_WINDOW = { startHour: 9, endHour: 20 };

/** Lembrete: enviar para agendamentos que começam dentro desta janela à frente. */
export const REMINDER_LOOKAHEAD_HOURS = 24;

/** Pós-serviço: enviar entre X e Y dias após a OS ser concluída. */
export const POST_SERVICE_MIN_DAYS = 3;
export const POST_SERVICE_MAX_DAYS = 10;

/** Status de agendamento que contam como "vai comparecer" (evita cutucar). */
export const ACTIVE_APPOINTMENT_STATUSES = ["agendado", "confirmado", "em_andamento"];
