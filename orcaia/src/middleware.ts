import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/core/session";

// Primeira barreira das rotas protegidas. Aqui so verificamos a PRESENCA do
// cookie de sessao — barato e sem tocar no banco. A validacao real (usuario e
// membro? sessao cortada?) acontece em getCurrentContext()/requireContext() a
// cada request nas paginas e actions.

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/clientes",
  "/produtos",
  "/materiais",
  "/custos",
  "/orcamentos",
  "/vidros",
  "/configuracoes",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!isProtected) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get(COOKIE_NAME)?.value);
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clientes/:path*",
    "/produtos/:path*",
    "/materiais/:path*",
    "/custos/:path*",
    "/orcamentos/:path*",
    "/vidros/:path*",
    "/configuracoes/:path*",
  ],
};
