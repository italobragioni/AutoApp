import "server-only";

import type {
  ConnectResult,
  MessagingProvider,
  ProviderStatus,
  SendInput,
  SendResult,
} from "@/lib/messaging/types";

/**
 * Provider da Evolution API — ESQUELETO para o futuro.
 *
 * A Evolution API NÃO é instalada dentro deste projeto: será um serviço externo,
 * hospedado separadamente. Este arquivo só reserva o formato da integração para
 * que, quando chegar a hora, baste implementar os métodos aqui — a lógica de
 * negócio (motor de automação) não muda.
 *
 * As credenciais ficam SÓ no servidor (EVOLUTION_API_URL, EVOLUTION_API_KEY) e
 * nunca vão para o frontend. Nesta fase nenhum método faz requisição real.
 */
export class EvolutionProvider implements MessagingProvider {
  readonly name = "evolution" as const;

  private baseUrl = process.env.EVOLUTION_API_URL?.trim() || "";
  // Lida aqui apenas para deixar claro que é server-only; não é exposta.
  private apiKey = process.env.EVOLUTION_API_KEY?.trim() || "";

  private notReady(): never {
    throw new Error(
      "EvolutionProvider ainda não implementado. Configure EVOLUTION_API_URL/KEY e implemente a integração antes de usar WHATSAPP_PROVIDER=evolution.",
    );
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

  /** Só para leitura futura; evita "declarado e não usado" e documenta a config. */
  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }
}
