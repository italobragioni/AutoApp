import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { db } from "@/lib/db";

/**
 * Tokens de conta: recuperacao de senha e verificacao de e-mail.
 *
 * Tres regras valem para os dois casos, e estao todas aqui em vez de espalhadas
 * pelas actions:
 *
 *   1. O que vai no link nunca e gravado. O banco guarda o SHA-256 dele, e a
 *      busca e feita pelo hash. Um vazamento da tabela nao entrega nenhum link
 *      utilizavel.
 *   2. Todo token expira.
 *   3. Todo token vale uma vez. `usedAt` e carimbado na primeira utilizacao, e
 *      quem chega depois recebe a mesma recusa de um token invalido.
 *
 * SHA-256 sem sal e proposital: diferente de senha, o token ja e 32 bytes
 * aleatorios, entao nao ha o que um ataque de dicionario adivinhe — e o hash
 * precisa ser deterministico para servir de chave de busca.
 */

export const TOKEN_PURPOSE = {
  /** Redefinir a senha. Prazo curto: e a credencial mais sensivel. */
  recuperacao: { minutes: 60 },
  /** Confirmar o e-mail. Prazo folgado: nao bloqueia nada enquanto isso. */
  verificacao: { minutes: 60 * 24 * 3 },
} as const;

export type TokenPurpose = keyof typeof TOKEN_PURPOSE;

/** Quantos pedidos do mesmo usuario e proposito cabem na janela. */
export const RATE_LIMIT = { max: 3, windowMinutes: 15 };

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Compara dois hashes em tempo constante.
 *
 * O ganho e pequeno (os dois lados ja sao hashes), mas comparar segredo com
 * `===` e o tipo de detalhe que envelhece mal quando alguem reaproveita a
 * funcao para outra coisa.
 */
function sameHash(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Cria um token e devolve o valor em claro UMA unica vez.
 *
 * Quem chama e responsavel por entregar esse valor (por e-mail) e esquece-lo:
 * depois daqui, so existe o hash.
 */
export async function issueToken(userId: string, purpose: TokenPurpose) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_PURPOSE[purpose].minutes * 60 * 1000);

  await db.authToken.create({
    data: { userId, purpose, tokenHash: hashToken(token), expiresAt },
  });

  return { token, expiresAt };
}

/**
 * Limite simples de pedidos, contado no proprio banco.
 *
 * Sem Redis e sem infraestrutura nova: a tabela de tokens ja registra cada
 * pedido com data, entao contar os recentes responde a pergunta. Serve para
 * conter o abuso obvio (alguem martelando "reenviar"), nao para deter um
 * ataque distribuido.
 */
export async function withinRateLimit(userId: string, purpose: TokenPurpose) {
  const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60 * 1000);
  const recent = await db.authToken.count({
    where: { userId, purpose, createdAt: { gte: since } },
  });
  return recent < RATE_LIMIT.max;
}

export type TokenCheck =
  | { ok: true; id: string; userId: string }
  | { ok: false; reason: "invalido" | "expirado" | "usado" };

/**
 * Verifica um token sem consumi-lo — para a tela decidir o que mostrar antes
 * de pedir a nova senha.
 */
export async function checkToken(token: string, purpose: TokenPurpose): Promise<TokenCheck> {
  if (!token) return { ok: false, reason: "invalido" };

  const record = await db.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, purpose: true, expiresAt: true, usedAt: true, tokenHash: true },
  });

  // Proposito diferente nao vale: um link de verificacao nao troca senha.
  if (!record || record.purpose !== purpose) return { ok: false, reason: "invalido" };
  if (!sameHash(record.tokenHash, hashToken(token))) return { ok: false, reason: "invalido" };
  if (record.usedAt) return { ok: false, reason: "usado" };
  if (record.expiresAt < new Date()) return { ok: false, reason: "expirado" };

  return { ok: true, id: record.id, userId: record.userId };
}

/**
 * Consome o token: valida e carimba `usedAt` na mesma operacao.
 *
 * O `updateMany` com `usedAt: null` no filtro e o que fecha a corrida: se dois
 * pedidos chegarem juntos, apenas um encontra a linha ainda nao usada e o
 * outro recebe zero.
 */
export async function consumeToken(token: string, purpose: TokenPurpose): Promise<TokenCheck> {
  const check = await checkToken(token, purpose);
  if (!check.ok) return check;

  const claimed = await db.authToken.updateMany({
    where: { id: check.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return { ok: false, reason: "usado" };

  return check;
}

/**
 * Invalida os tokens pendentes de um proposito.
 * Usado ao emitir um novo: dois links validos ao mesmo tempo dobram a
 * superficie de ataque sem beneficio nenhum.
 */
export async function revokePendingTokens(userId: string, purpose: TokenPurpose) {
  await db.authToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });
}
