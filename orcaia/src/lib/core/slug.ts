import "server-only";
import { prisma } from "./db";

/** Normaliza um texto em um slug URL-safe. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "empresa";
}

/**
 * Gera um slug unico para Company, adicionando sufixo numerico se necessario.
 */
export async function uniqueCompanySlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let n = 1;
  // Loop curto: colisoes sao raras. Cada iteracao checa a existencia.
  while (await prisma.company.findUnique({ where: { slug: candidate } })) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}
