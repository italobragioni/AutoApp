import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="text-sm font-semibold text-brand">
        ORCAIA
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-ink">Entrar</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Acesse sua conta para gerenciar orcamentos.
      </p>

      <div className="mt-8">
        <LoginForm />
      </div>

      <p className="mt-6 text-sm text-ink-soft">
        Ainda nao tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-brand">
          Criar conta
        </Link>
      </p>
    </main>
  );
}
