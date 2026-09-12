import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export default function CadastroPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="text-sm font-semibold text-brand">
        ORCAIA
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-ink">Criar conta</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Cadastre sua empresa e comece a gerar orcamentos.
      </p>

      <div className="mt-8">
        <RegisterForm />
      </div>

      <p className="mt-6 text-sm text-ink-soft">
        Ja tem conta?{" "}
        <Link href="/login" className="font-medium text-brand">
          Entrar
        </Link>
      </p>
    </main>
  );
}
