"use client";

import { useActionState } from "react";
import { registerAction, type FormState } from "@/app/actions/auth";
import { NICHES } from "@/lib/niches";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    registerAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Seu nome</Label>
        <Input id="name" name="name" autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <hr className="border-surface-border" />

      <div>
        <Label htmlFor="companyName">Nome da empresa</Label>
        <Input id="companyName" name="companyName" required />
      </div>
      <div>
        <Label htmlFor="niche">Nicho da empresa</Label>
        <Select id="niche" name="niche" defaultValue="" required>
          <option value="" disabled>
            Selecione...
          </option>
          {NICHES.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </Select>
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Criando..." : "Criar conta"}
      </Button>
    </form>
  );
}
