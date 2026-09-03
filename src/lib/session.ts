import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "autovolt_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export type SessionPayload = {
  userId: string;
  /** Empresa ativa. Toda query da aplicacao e escopada por este id. */
  companyId: string;
  /**
   * Quando o cookie foi assinado, em segundos (o `iat` do JWT).
   *
   * E o que permite derrubar sessoes antigas sem guardar sessao no banco:
   * `User.sessionsValidFrom` marca o corte, e um cookie assinado antes dele
   * deixa de valer (ver src/lib/tenant.ts).
   */
  issuedAt?: number;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error(
      "AUTH_SECRET ausente ou muito curto. Defina-o no .env (veja .env.example).",
    );
  }
  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload) {
  // `issuedAt` nao vai no corpo: quem o define e o proprio `setIssuedAt()`.
  const { issuedAt: _ignored, ...claims } = payload;
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("autovolt")
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "autovolt" });
    if (typeof payload.userId !== "string" || typeof payload.companyId !== "string") {
      return null;
    }
    return {
      userId: payload.userId,
      companyId: payload.companyId,
      issuedAt: typeof payload.iat === "number" ? payload.iat : undefined,
    };
  } catch {
    return null;
  }
}

export async function createSessionCookie(payload: SessionPayload) {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
