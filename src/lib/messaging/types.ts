import "server-only";

/**
 * Contrato único de mensageria do AUTOVOLT.
 *
 * Toda comunicação com WhatsApp passa por esta interface — o motor de automação
 * (src/lib/whatsapp) nunca fala com a Evolution API (ou qualquer provider)
 * diretamente. Trocar de provider no futuro é trocar a implementação, sem mexer
 * na lógica de negócio.
 */

export type MessagingProviderName = "mock" | "evolution" | "cloud";

export type SendInput = {
  /** Telefone de destino em E.164 (ex.: +5511999998888). */
  to: string;
  /** Mensagem final, já com as variáveis substituídas. */
  message: string;
};

export type SendResult = {
  status: "sent" | "failed";
  externalMessageId?: string;
  error?: string;
};

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export type ProviderStatus = {
  status: ConnectionStatus;
  phoneNumber?: string | null;
  instanceName?: string | null;
};

export type ConnectResult = {
  status: ConnectionStatus;
  /** QR Code (data URL/base64) quando o provider suportar. Futuro. */
  qrCode?: string | null;
  instanceName?: string | null;
};

export interface MessagingProvider {
  readonly name: MessagingProviderName;
  /** Envia (ou simula) uma mensagem. Nunca lança: erros voltam em SendResult. */
  send(input: SendInput): Promise<SendResult>;
  /** Estado atual da conexão. */
  getStatus(): Promise<ProviderStatus>;
  /** Inicia a conexão (futuro: devolve QR Code). */
  connect(): Promise<ConnectResult>;
  /** Encerra a conexão. */
  disconnect(): Promise<void>;
  /** QR Code atual, quando aplicável. Futuro. */
  getQrCode(): Promise<string | null>;
}
