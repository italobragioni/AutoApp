import "server-only";

import type {
  ConnectResult,
  MessagingProvider,
  ProviderStatus,
  SendInput,
  SendResult,
} from "@/lib/messaging/types";

/**
 * Provider de simulação — a fase atual do produto.
 *
 * Simula o envio (ENVIANDO → ENVIADA) sem que nenhuma mensagem real saia do
 * sistema. Toda a estrutura (decisão, cooldown, idempotência, histórico) é a
 * real; só o "envio" é fingido. Quando a Evolution API entrar, troca-se o
 * provider e nada mais muda.
 *
 * Falha simulável para teste: um número de destino que contenha a sequência
 * "000000000" é tratado como inválido e retorna status "failed" — assim dá para
 * exercitar o caminho de erro sem afetar produção.
 */
export class MockProvider implements MessagingProvider {
  readonly name = "mock" as const;

  async send(input: SendInput): Promise<SendResult> {
    if (!input.to || input.to.replace(/\D/g, "").length < 8) {
      return { status: "failed", error: "Número de telefone inválido." };
    }
    if (input.to.includes("000000000")) {
      return { status: "failed", error: "Falha simulada de envio (número de teste)." };
    }
    return {
      status: "sent",
      externalMessageId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    return { status: "disconnected" };
  }

  async connect(): Promise<ConnectResult> {
    // Na simulação não há QR real. A action de "simular conexão" cuida de marcar
    // a integração como conectada no banco.
    return { status: "connecting", qrCode: null };
  }

  async disconnect(): Promise<void> {
    // Nada a fazer no mock.
  }

  async getQrCode(): Promise<string | null> {
    return null;
  }
}
