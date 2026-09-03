import "server-only";

import { appendFile } from "node:fs/promises";

/**
 * Camada de envio de e-mail.
 *
 * O AUTOVOLT ainda nao tem provedor contratado, e esta etapa nao exige um. Em
 * vez de deixar o fluxo de recuperacao de senha esperando por isso, o envio
 * passa por aqui e cada ambiente escolhe um transporte:
 *
 *   console  (padrao em desenvolvimento) — imprime a mensagem no terminal do
 *            servidor, com o link clicavel.
 *   file     — grava cada mensagem em .mail-outbox.log (JSON por linha). Serve
 *            para desenvolvimento e e o que os testes automatizados leem para
 *            recuperar o link, como um usuario faria na caixa de entrada.
 *   none     (padrao em producao) — nada e enviado, e fica registrado um aviso.
 *
 * Quando houver provedor, ele entra como mais um caso do `switch` em
 * `deliver()`: nenhuma action precisa mudar, porque todas falam com
 * `sendMail()`. O conteudo das mensagens ja esta pronto em `templates`.
 *
 * O link nunca volta para a interface em producao — quem decide isso e
 * `canRevealLink()`, e as actions respeitam.
 */

export type MailMessage = {
  to: string;
  subject: string;
  /** Corpo em texto puro. Simples de propósito: nao ha provedor para HTML ainda. */
  text: string;
};

export type MailResult = { delivered: boolean; transport: string };

const OUTBOX_FILE = process.env.MAIL_OUTBOX_FILE ?? ".mail-outbox.log";

function transport() {
  const configured = process.env.MAIL_TRANSPORT?.trim().toLowerCase();
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? "none" : "console";
}

/**
 * O link pode aparecer na tela?
 *
 * So fora de producao E com um transporte de desenvolvimento. Em producao a
 * resposta e sempre nao, mesmo que alguem configure o transporte errado.
 */
export function canRevealLink() {
  if (process.env.NODE_ENV === "production") return false;
  return transport() === "console" || transport() === "file";
}

async function deliver(message: MailMessage): Promise<MailResult> {
  const mode = transport();

  switch (mode) {
    case "console":
      console.info(
        `\n[e-mail:${mode}] para: ${message.to}\n  assunto: ${message.subject}\n  ${message.text.replace(/\n/g, "\n  ")}\n`,
      );
      return { delivered: true, transport: mode };

    case "file":
      await appendFile(
        OUTBOX_FILE,
        `${JSON.stringify({ ...message, at: new Date().toISOString() })}\n`,
        "utf8",
      );
      return { delivered: true, transport: mode };

    default:
      // Producao sem provedor: registra o suficiente para saber que uma
      // mensagem deixou de sair, sem jamais escrever o link no log.
      console.warn(
        `[e-mail:none] mensagem "${message.subject}" nao enviada: nenhum provedor configurado.`,
      );
      return { delivered: false, transport: "none" };
  }
}

/**
 * Envia — ou registra, conforme o transporte. Nunca lanca: uma falha de e-mail
 * nao pode derrubar o fluxo de quem esta tentando recuperar a conta.
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  try {
    return await deliver(message);
  } catch (error) {
    console.error("[e-mail] falha ao entregar a mensagem:", error);
    return { delivered: false, transport: transport() };
  }
}

/** Textos das mensagens, em um lugar so. */
export const templates = {
  passwordReset(link: string, minutes: number) {
    return {
      subject: "Redefinir sua senha do AUTOVOLT",
      text: [
        "Recebemos um pedido para redefinir a senha da sua conta no AUTOVOLT.",
        "",
        `Abra este link para criar uma nova senha: ${link}`,
        "",
        `O link vale por ${minutes} minutos e só pode ser usado uma vez.`,
        "Se não foi você que pediu, ignore esta mensagem — sua senha continua a mesma.",
      ].join("\n"),
    };
  },

  emailVerification(link: string, name: string) {
    return {
      subject: "Confirme seu e-mail no AUTOVOLT",
      text: [
        `Olá, ${name.split(" ")[0]}!`,
        "",
        `Confirme seu e-mail abrindo este link: ${link}`,
        "",
        "O link vale por 3 dias e só pode ser usado uma vez.",
      ].join("\n"),
    };
  },
};
