"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { loadDemoData } from "@/app/actions/demo";
import { Button } from "@/components/ui/button";

// Botao que popula a empresa logada com dados de demonstracao (catalogo +
// clientes + orcamentos de exemplo) para o usuario testar o sistema.
export function DemoDataButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
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
      {pending ? "Carregando dados..." : "Carregar dados de demonstração"}
    </Button>
  );
}
