import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ senha?: string }>;
}) {
  const senhaRedefinida = (await searchParams).senha === "redefinida";

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white">Entrar na plataforma</h1>
      <p className="mt-2 text-sm text-muted">
        Acesse o painel da sua estética automotiva.
      </p>

      <LoginForm senhaRedefinida={senhaRedefinida} />

      <p className="mt-8 text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="focus-ring rounded font-medium text-volt-400 hover:text-volt-300">
          Criar conta grátis
        </Link>
      </p>
    </div>
  );
}
