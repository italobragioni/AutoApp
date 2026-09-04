import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * Primeira barreira de acesso: bloqueia rotas da área logada sem sessão válida.
 * A verificação definitiva continua sendo feita no servidor (requireContext),
 * que também confirma se o usuário ainda é membro da empresa da sessão.
 */
const PROTECTED = [
  "/dashboard",
  "/agenda",
  "/clientes",
  "/veiculos",
  "/servicos",
  "/orcamentos",
  "/ordens",
  "/retencao",
  "/campanhas",
  "/relatorios",
  "/configuracoes",
  // Exige login, mas NAO assinatura ativa — e o destino de quem ainda nao pagou.
  "/assinatura",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const response = NextResponse.redirect(url);
    // Remove cookie expirado/inválido para não repetir o ciclo.
    if (token) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/agenda/:path*",
    "/clientes/:path*",
    "/veiculos/:path*",
    "/servicos/:path*",
    "/orcamentos/:path*",
    "/ordens/:path*",
    "/retencao/:path*",
    "/campanhas/:path*",
    "/relatorios/:path*",
    "/configuracoes/:path*",
    "/assinatura/:path*",
  ],
};
