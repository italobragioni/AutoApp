import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Valores monetarios sao guardados em centavos no banco. */
export function money(cents: number) {
  return BRL.format((cents ?? 0) / 100);
}

export function moneyCompact(cents: number) {
  const value = (cents ?? 0) / 100;
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  }
  return BRL.format(value);
}

export function parseMoneyToCents(input: string): number {
  const normalized = input
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function dateShort(date: Date | string) {
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function dateFull(date: Date | string) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function dateLong(date: Date | string) {
  return new Date(date).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function time(date: Date | string) {
  return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function daysBetween(from: Date, to: Date = new Date()) {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function phoneMask(phone?: string | null) {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function plateMask(plate?: string | null) {
  if (!plate) return "—";
  return plate.toUpperCase();
}

/** Link de WhatsApp com mensagem pre-preenchida (usado em Retencao e Campanhas). */
export function whatsappLink(phone: string | null | undefined, message: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

export function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

/** "vs. mesmo dia do mês anterior" / "vs. mesmos 12 dias do mês anterior". */
export function samePeriodHint(elapsedDays: number) {
  return elapsedDays === 1
    ? "vs. mesmo dia do mês anterior"
    : `vs. mesmos ${elapsedDays} dias do mês anterior`;
}
