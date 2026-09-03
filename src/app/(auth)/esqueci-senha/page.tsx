import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white">Recuperar senha</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Informe o e-mail da sua conta. Se houver cadastro, enviamos um link para você criar uma
        nova senha.
      </p>

      <ForgotPasswordForm />

      <p className="mt-8 text-center text-sm text-muted">
        Lembrou a senha?{" "}
        <Link
          href="/login"
          className="focus-ring rounded font-medium text-volt-400 hover:text-volt-300"
        >
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
