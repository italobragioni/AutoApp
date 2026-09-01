import type { Metadata } from "next";
import Link from "next/link";

import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Criar conta" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white">Criar sua conta</h1>
      <p className="mt-2 text-sm text-muted">
        Cadastre sua empresa e comece a organizar os atendimentos hoje.
      </p>

      <RegisterForm />

      <p className="mt-8 text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="focus-ring rounded font-medium text-volt-400 hover:text-volt-300">
          Entrar
        </Link>
      </p>
    </div>
  );
}
