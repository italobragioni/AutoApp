import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

// Sessao sem estado: um JWT assinado guardado em cookie httpOnly. Ele carrega
// apenas o necessario para reencontrar o usuario e a empresa ativa; a validacao
// real (o usuario ainda e membro da empresa?) acontece em cada request no
// tenant.ts, nunca confiando cegamente no cookie.

const COOKIE_NAME = "orcaia_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export type SessionPayload = {
  userId: string;
  companyId: string;
  // Emitido em (segundos). Comparado com User.sessionsValidFrom para permitir
  // derrubar sessoes antigas ao trocar a senha.
  iat?: number;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET nao definido. Configure o .env.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.userId !== "string" || typeof payload.companyId !== "string") {
      return null;
    }
    return {
      userId: payload.userId,
      companyId: payload.companyId,
      iat: payload.iat,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
