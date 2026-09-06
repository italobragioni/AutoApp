import type { AutomationType } from "@/lib/whatsapp/config";

/**
 * Mensagens padrão + variáveis.
 *
 * O sistema funciona imediatamente com estes textos — o dono não precisa
 * escrever nada. A personalização é opcional (colunas *Template em
 * WhatsAppAutomationSettings); nula = usa o padrão daqui.
 *
 * A mensagem FINAL (já com as variáveis substituídas) é o que se registra no
 * histórico — nunca só o template.
 */

export const DEFAULT_TEMPLATES: Record<AutomationType, string> = {
  risco:
    "Olá, {primeiro_nome}! 👋\n\nFaz um tempinho que não cuidamos do seu {veiculo} por aqui.\n\nQue tal agendar um horário para deixar ele impecável novamente? 🚗✨",
  inativo:
    "Olá, {primeiro_nome}! 👋\n\nSentimos sua falta por aqui.\n\nFaz um tempo que não vemos seu {veiculo} para receber os cuidados que merece. 🚗✨\n\nQuando quiser, estaremos prontos para deixar ele impecável novamente.",
  lembrete:
    "Olá, {primeiro_nome}! 👋\n\nPassando para lembrar que temos um horário reservado para o seu {veiculo}.\n\n📅 {data}\n⏰ {horario}\n\nEstamos te esperando! 🚗✨",
  pos_servico:
    "Olá, {primeiro_nome}! 👋\n\nQueríamos saber como está o seu {veiculo} depois do serviço.\n\nFicamos felizes em cuidar dele! 🚗✨",
};

export type MessageVars = {
  nome: string;
  primeiro_nome: string;
  veiculo: string;
  marca: string;
  modelo: string;
  placa: string;
  empresa: string;
  data: string;
  horario: string;
};

const VAR_KEYS: (keyof MessageVars)[] = [
  "nome",
  "primeiro_nome",
  "veiculo",
  "marca",
  "modelo",
  "placa",
  "empresa",
  "data",
  "horario",
];

/** Substitui {chave} pelos valores; variáveis desconhecidas viram string vazia. */
export function renderTemplate(template: string, vars: Partial<MessageVars>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    if ((VAR_KEYS as string[]).includes(key)) {
      return (vars[key as keyof MessageVars] ?? "").toString();
    }
    return "";
  });
}

/** Template efetivo de um tipo: o customizado da empresa, ou o padrão. */
export function templateFor(
  type: AutomationType,
  custom: {
    riskTemplate?: string | null;
    inactiveTemplate?: string | null;
    reminderTemplate?: string | null;
    postServiceTemplate?: string | null;
  } | null,
): string {
  const map: Record<AutomationType, string | null | undefined> = {
    risco: custom?.riskTemplate,
    inativo: custom?.inactiveTemplate,
    lembrete: custom?.reminderTemplate,
    pos_servico: custom?.postServiceTemplate,
  };
  const chosen = map[type];
  return chosen && chosen.trim() ? chosen : DEFAULT_TEMPLATES[type];
}
