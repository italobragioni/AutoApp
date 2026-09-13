"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { loadDemoData } from "@/app/actions/demo";
import { Button } from "@/components/ui/button";

type Props = {
  variant?: "primary" | "secondary" | "ghost";
  label?: string;
};

// Botao que popula a empresa logada com dados de demonstracao (catalogo +
// clientes + orcamentos de exemplo) para o usuario testar o sistema.
export function DemoDataButton({ variant = "primary", label = "Carregar dados de demonstração" }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant={variant}
      disabled={pending}
      className="whitespace-nowrap"
      onClick={() =>
        startTransition(async () => {
          await loadDemoData();
          router.refresh();
        })
      }
    >
      <Sparkles className="h-4 w-4" />
      {pending ? "Carregando dados..." : label}
    </Button>
  );
}
