import "server-only";

import { SEND_WINDOW } from "@/lib/whatsapp/config";

/**
 * Camada central de decisão — as regras genéricas que valem para QUALQUER envio,
 * num lugar só. As checagens específicas de cada automação (agendamento futuro,
 * OS concluída, estágio de retenção) ficam nas automações; as transversais
 * (janela de horário, cooldown, deduplicação) passam por aqui e pelo engine.
 *
 * A ordem completa de decisão antes de qualquer envio:
 *   1. automação (geral) ativa?              → engine (settings.enabled)
 *   2. integração conectada?                 → engine (integration.status)
 *   3. cliente tem telefone válido?          → engine (normalizePhoneBR)
 *   4. cliente elegível (estágio/evento)?    → automação
 *   5. status de contato aplicável?          → automação
 *   6. existe agendamento futuro?            → automação (risco/inativo)
 *   7. cliente voltou recentemente?          → automação (via estágio)
 *   8. já recebeu mensagem semelhante?       → engine (cooldown)
 *   9. está dentro do cooldown?              → engine (cooldown)
 *  10. este evento já foi processado?        → engine (dedupeKey @unique)
 *  11. está dentro do horário permitido?     → isWithinSendWindow
 */

/** Hora local (0–23) da empresa, respeitando o fuso configurado. */
export function companyLocalHour(timezone: string, now: Date): number {
  try {
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(now);
    // "24" pode aparecer em alguns runtimes para meia-noite; normaliza para 0.
    const n = Number.parseInt(hour, 10);
    return Number.isFinite(n) ? n % 24 : now.getHours();
  } catch {
    // Fuso inválido: cai no horário do servidor (melhor que quebrar).
    return now.getHours();
  }
}

/** Está dentro da janela permitida de envio? */
export function isWithinSendWindow(timezone: string, now: Date): boolean {
  const hour = companyLocalHour(timezone, now);
  return hour >= SEND_WINDOW.startHour && hour < SEND_WINDOW.endHour;
}
