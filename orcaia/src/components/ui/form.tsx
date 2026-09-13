"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/core/cn";
import { Button } from "./button";
import { Label, Input, Select } from "./field";

// Botao de envio que reflete o estado pendente do formulario automaticamente.
export function SubmitButton({
  children,
  className,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} className={className} {...props}>
      {pending ? "Salvando..." : children}
    </Button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      {message}
    </p>
  );
}

// Campo de texto com rotulo e erro. Reduz a repeticao nos formularios.
export function TextField({
  label,
  name,
  error,
  className,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        className={cn(error && "border-red-400 focus:border-red-400 focus:ring-red-200")}
        {...props}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function SelectField({
  label,
  name,
  error,
  className,
  children,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={className}>
      <Label htmlFor={name}>{label}</Label>
      <Select
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        className={cn(error && "border-red-400 focus:border-red-400 focus:ring-red-200")}
        {...props}
      >
        {children}
      </Select>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  error,
  className,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={className}>
      <Label htmlFor={name}>{label}</Label>
      <textarea
        id={name}
        name={name}
        className={cn(
          "w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
          error && "border-red-400 focus:border-red-400 focus:ring-red-200",
        )}
        {...props}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function CheckboxField({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-surface-border text-brand focus:ring-brand/30"
      />
      {label}
    </label>
  );
}
