// Papeis e permissoes. Modelo simples e explicito: owner > manager > staff.
//
// Mantido pequeno de proposito. Conforme os modulos crescerem, cada acao passa
// a declarar a permissao minima aqui, e as Server Actions/rotas checam com
// `can()` — nunca espalhando comparacoes de string de papel pelo codigo.

export type Role = "owner" | "manager" | "staff";

const RANK: Record<Role, number> = {
  owner: 3,
  manager: 2,
  staff: 1,
};

export function isRole(value: string): value is Role {
  return value === "owner" || value === "manager" || value === "staff";
}

/** Verdadeiro se `role` tem pelo menos o nivel de `minimum`. */
export function atLeast(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}
