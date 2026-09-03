"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  RATE_LIMIT,
  TOKEN_PURPOSE,
  consumeToken,
  issueToken,
  revokePendingTokens,
  withinRateLimit,
} from "@/lib/auth-tokens";
import { db } from "@/lib/db";
import { canRevealLink, sendMail, templates } from "@/lib/mailer";
import { hashPassword } from "@/lib/password";
import { destroySessionCookie } from "@/lib/session";
import { getCurrentContext } from "@/lib/tenant";

/**
 * Recuperacao de senha e verificacao de e-mail.
 *
 * Duas preocupacoes atravessam o arquivo:
 *
 *   Nao contar quem existe. Pedir recuperacao devolve sempre a mesma resposta,
 *   no mesmo formato, exista ou nao a conta. Sem isso, o formulario vira uma
 *   ferramenta para descobrir quais e-mails tem cadastro.
 *
 *   Nao confiar no cliente. O token e a unica prova aceita, e ele e conferido
 *   no servidor a cada passo — id de usuario e e-mail vindos do formulario nao
 *   autorizam nada.
 */

export type AccountState =
  | { ok?: boolean; error?: string; message?: string; link?: string }
  | undefined;

/** Resposta unica do pedido de recuperacao. */
const GENERIC_RESPONSE =
  "Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha.";

/** Politica minima de senha — a mesma ja usada no cadastro. */
const MIN_PASSWORD = 8;

/**
 * Base absoluta dos links. Prefere a URL publica configurada; sem ela, usa o
 * host da propria requisicao.
 */
async function appUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/* -------------------------------------------------------------------------- */
/* Recuperacao de senha                                                        */
/* -------------------------------------------------------------------------- */

const emailSchema = z.object({ email: z.string().email() });

export async function requestPasswordResetAction(
  _state: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const parsed = emailSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
  });

  // Ate um e-mail malformado recebe a resposta generica: reclamar so de
  // alguns casos ja seria um sinal.
  if (!parsed.success) return { ok: true, message: GENERIC_RESPONSE };

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true },
  });

  // Conta inexistente: mesma resposta, mesmo tempo de espera aparente, e nada
  // e criado no banco.
  if (!user) return { ok: true, message: GENERIC_RESPONSE };

  // Limite de pedidos. O usuario legitimo tambem recebe a resposta generica —
  // avisar "voce pediu demais" contaria que a conta existe.
  if (!(await withinRateLimit(user.id, "recuperacao"))) {
    return { ok: true, message: GENERIC_RESPONSE };
  }

  // Um link valido por vez.
  await revokePendingTokens(user.id, "recuperacao");
  const { token } = await issueToken(user.id, "recuperacao");

  const link = `${await appUrl()}/redefinir-senha/${token}`;
  const message = templates.passwordReset(link, TOKEN_PURPOSE.recuperacao.minutes);
  await sendMail({ to: parsed.data.email, ...message });

  return {
    ok: true,
    message: GENERIC_RESPONSE,
    // Em producao isto e sempre undefined: o link so aparece na tela em
    // desenvolvimento, quando nao ha provedor de e-mail para entrega-lo.
    link: canRevealLink() ? link : undefined,
  };
}

const resetSchema = z
  .object({
    token: z.string().min(10, "Link inválido."),
    password: z
      .string()
      .min(MIN_PASSWORD, `A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.`),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "As senhas não são iguais.",
  });

/**
 * Redefine a senha.
 *
 * O token e consumido ANTES da troca: se algo falhar depois, o link ja nao vale
 * mais — o contrario deixaria um link vivo depois de uma tentativa.
 */
export async function resetPasswordAction(
  _state: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const parsed = resetSchema.safeParse({
    token: String(formData.get("token") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const check = await consumeToken(parsed.data.token, "recuperacao");
  if (!check.ok) {
    return {
      error:
        check.reason === "expirado"
          ? "Este link expirou. Peça uma nova recuperação."
          : check.reason === "usado"
            ? "Este link já foi utilizado. Peça uma nova recuperação."
            : "Link inválido. Peça uma nova recuperação.",
    };
  }

  await db.user.update({
    where: { id: check.userId },
    data: {
      // Mesmo bcrypt do resto da plataforma.
      passwordHash: await hashPassword(parsed.data.password),
      // Corta as sessoes abertas antes de agora: se alguem entrou com a senha
      // antiga, perde o acesso na proxima navegacao.
      sessionsValidFrom: new Date(),
    },
  });

  // O proprio navegador que redefiniu tambem recomeca — entrar com a senha
  // nova e a confirmacao de que deu certo.
  await destroySessionCookie();

  redirect("/login?senha=redefinida");
}

/* -------------------------------------------------------------------------- */
/* Verificacao de e-mail                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Emite e envia o link de verificacao. Usada no cadastro, no aceite de convite
 * e no reenvio — sempre a mesma rotina.
 */
export async function sendVerificationEmail(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, emailVerifiedAt: true },
  });
  if (!user || user.emailVerifiedAt) return { sent: false, link: undefined };

  await revokePendingTokens(user.id, "verificacao");
  const { token } = await issueToken(user.id, "verificacao");

  const link = `${await appUrl()}/verificar-email/${token}`;
  await sendMail({ to: user.email, ...templates.emailVerification(link, user.name) });

  return { sent: true, link: canRevealLink() ? link : undefined };
}

/** Reenvio pedido pelo proprio usuario, a partir do aviso na plataforma. */
export async function resendVerificationAction(
  _state: AccountState,
  _formData: FormData,
): Promise<AccountState> {
  const context = await getCurrentContext();
  if (!context) return { error: "Sua sessão expirou. Entre novamente." };

  const user = await db.user.findUnique({
    where: { id: context.user.id },
    select: { emailVerifiedAt: true },
  });
  if (user?.emailVerifiedAt) return { ok: true, message: "Seu e-mail já está verificado." };

  // Aqui o limite pode ser dito com todas as letras: o usuario esta logado,
  // entao nao ha o que enumerar.
  if (!(await withinRateLimit(context.user.id, "verificacao"))) {
    return {
      error: `Você já pediu ${RATE_LIMIT.max} envios agora há pouco. Tente de novo em ${RATE_LIMIT.windowMinutes} minutos.`,
    };
  }

  const result = await sendVerificationEmail(context.user.id);

  return {
    ok: true,
    message: "Link de verificação enviado para o seu e-mail.",
    link: result.link,
  };
}

/**
 * Confirma o e-mail.
 *
 * O consumo do token acontece por acao explicita do usuario (um botao), e nao
 * ao abrir o link: antivirus e servicos de e-mail costumam visitar links
 * automaticamente, e isso queimaria a verificacao antes da pessoa clicar.
 */
export async function verifyEmailAction(
  _state: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const token = String(formData.get("token") ?? "").trim();

  const check = await consumeToken(token, "verificacao");
  if (!check.ok) {
    return {
      error:
        check.reason === "expirado"
          ? "Este link de verificação expirou. Peça um novo pela plataforma."
          : check.reason === "usado"
            ? "Este link já foi utilizado."
            : "Link de verificação inválido.",
    };
  }

  await db.user.update({
    where: { id: check.userId },
    data: { emailVerifiedAt: new Date() },
  });

  // Sem revalidatePath aqui de proposito: revalidar o layout re-renderizaria
  // ESTA pagina, que voltaria a consultar o token — agora consumido — e
  // trocaria a confirmacao por "este link ja foi utilizado". O aviso do topo
  // desaparece na proxima navegacao, que e justamente para onde o botao leva.
  return { ok: true, message: "E-mail verificado com sucesso." };
}
