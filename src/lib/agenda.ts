/**
 * Regras compartilhadas da Agenda.
 *
 * Ficam aqui para a pagina de leitura e as server actions usarem exatamente o
 * mesmo criterio — sem duplicar logica em dois lugares.
 */

export type AppointmentServiceLike = {
  serviceItem: { basePrice: number; durationMin?: number } | null;
};

/**
 * Valor efetivo de um agendamento.
 *
 * `priceCents` guarda o valor combinado com o cliente. Quando esta nulo — que
 * e o caso de todo agendamento criado antes deste campo existir — vale a soma
 * dos precos de catalogo dos servicos, que era o comportamento anterior.
 */
export function appointmentValueCents(appointment: {
  priceCents: number | null;
  services: AppointmentServiceLike[];
}) {
  if (appointment.priceCents !== null) return appointment.priceCents;
  return appointment.services.reduce(
    (sum, entry) => sum + (entry.serviceItem?.basePrice ?? 0),
    0,
  );
}

/** Duracao total sugerida por um conjunto de servicos, em minutos. */
export function suggestedDurationMin(services: { durationMin: number }[]) {
  return services.reduce((sum, service) => sum + service.durationMin, 0);
}

/** Soma dos precos de catalogo, em centavos. */
export function suggestedPriceCents(services: { basePrice: number }[]) {
  return services.reduce((sum, service) => sum + service.basePrice, 0);
}

/**
 * Status que ocupam a agenda de fato.
 *
 * Cancelado e nao compareceu liberam o horario, entao nao entram na checagem
 * de conflito nem nos indicadores de ocupacao.
 */
export const BLOCKING_STATUSES = [
  "agendado",
  "confirmado",
  "em_andamento",
  "concluido",
] as const;

/** Dois intervalos se sobrepoem quando um comeca antes de o outro terminar. */
export function overlaps(
  a: { startsAt: Date; endsAt: Date },
  b: { startsAt: Date; endsAt: Date },
) {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}
