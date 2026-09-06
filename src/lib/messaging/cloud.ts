import "server-only";

import type {
  ConnectResult,
  MessagingProvider,
  ProviderStatus,
  SendInput,
  SendResult,
} from "@/lib/messaging/types";

/**
 * Provider do WhatsApp Cloud API (Meta) — STUB, possibilidade futura.
 *
 * Reservado como alternativa à Evolution API. Não implementado nesta fase.
 */
export class WhatsAppCloudProvider implements MessagingProvider {
  readonly name = "cloud" as const;

  private notReady(): never {
    throw new Error("WhatsAppCloudProvider ainda não implementado.");
  }

  async send(_input: SendInput): Promise<SendResult> {
    return this.notReady();
  }
  async getStatus(): Promise<ProviderStatus> {
    return this.notReady();
  }
  async connect(): Promise<ConnectResult> {
    return this.notReady();
  }
  async disconnect(): Promise<void> {
    return this.notReady();
  }
  async getQrCode(): Promise<string | null> {
    return this.notReady();
  }
}
