import "server-only";

import { MockProvider } from "@/lib/messaging/mock";
import { EvolutionProvider } from "@/lib/messaging/evolution";
import { WhatsAppCloudProvider } from "@/lib/messaging/cloud";
import type { MessagingProvider, MessagingProviderName } from "@/lib/messaging/types";

/**
 * Fábrica de provider de mensageria — o único ponto que decide QUEM envia.
 *
 * O provider vem de WHATSAPP_PROVIDER (padrão "mock"). Um `provider` explícito
 * (ex.: o gravado na integração da empresa) tem prioridade. Todo o resto do
 * sistema depende apenas da interface MessagingProvider, nunca de um provider
 * concreto.
 */
export function activeProviderName(): MessagingProviderName {
  const raw = process.env.WHATSAPP_PROVIDER?.trim().toLowerCase();
  if (raw === "evolution" || raw === "cloud" || raw === "mock") return raw;
  return "mock";
}

export function getProvider(name?: MessagingProviderName): MessagingProvider {
  switch (name ?? activeProviderName()) {
    case "evolution":
      return new EvolutionProvider();
    case "cloud":
      return new WhatsAppCloudProvider();
    case "mock":
    default:
      return new MockProvider();
  }
}

export type { MessagingProvider } from "@/lib/messaging/types";
