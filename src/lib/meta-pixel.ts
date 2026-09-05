/**
 * Meta Pixel (navegador) — helper reutilizável de eventos.
 *
 * O ID do Pixel é público (NEXT_PUBLIC_META_PIXEL_ID) e o script base é carregado
 * uma única vez por src/components/analytics/MetaPixel.tsx. Aqui ficam só as
 * chamadas de eventos, todas guardadas: se o Pixel não estiver carregado (env
 * ausente, bloqueador de anúncios), viram no-op — nunca quebram a interface.
 *
 * Nenhum dado sensível é enviado pelo navegador: apenas o nome do evento e, no
 * checkout, valor e moeda do plano.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

type EventParams = Record<string, unknown>;

/** Dispara um evento padrão da Meta, se o Pixel estiver disponível. */
export function trackEvent(event: string, params?: EventParams): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (params) window.fbq("track", event, params);
  else window.fbq("track", event);
}

/** Interesse em criar conta (clique num CTA da página de vendas). */
export function trackLead(): void {
  trackEvent("Lead");
}

/** Conta criada com sucesso. */
export function trackCompleteRegistration(): void {
  trackEvent("CompleteRegistration");
}

/** Início real do checkout (redirecionamento para a Cakto). */
export function trackInitiateCheckout(value: number, currency = "BRL"): void {
  trackEvent("InitiateCheckout", { value, currency });
}
