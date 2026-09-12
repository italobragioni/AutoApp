"use client";

import { Trash2 } from "lucide-react";

type Action = (formData: FormData) => void | Promise<void>;

// Botao de exclusao: um form com id oculto que chama a Server Action, pedindo
// confirmacao antes de enviar.
export function DeleteButton({
  action,
  id,
  label = "Excluir",
}: {
  action: Action;
  id: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Tem certeza que deseja excluir?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={label}
        title={label}
        className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </form>
  );
}
