"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { permit } from "@/lib/authorize";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { ROLES, isRole } from "@/lib/permissions";
import { createSessionCookie, readSession } from "@/lib/session";
import { slugify } from "@/lib/slug";

/**
 * Equipe: convites, papeis, remocao e criacao de empresa.
 *
 * Tudo passa pela mesma arquitetura que ja existia — User, Company e
 * Membership. O convite e so o passo anterior ao Membership; aceitar um convite
 * cria exatamente o mesmo vinculo que o cadastro sempre criou.
 *
 * Duas regras atravessam o arquivo inteiro:
 *
 *   1. A empresa vem SEMPRE da sessao (via `permit`), nunca do formulario.
 *      Ids de membro e de convite sao conferidos contra ela antes de qualquer
 *      escrita — um administrador da empresa A nao alcanca a empresa B.
 *
 *   2. A empresa nunca pode ficar sem administrador. Rebaixar ou remover o
 *      ultimo owner e recusado no servidor.
 */

export type TeamState = { ok?: boolean; error?: string; token?: string } | undefined;

const INVITE_DAYS = 7;

/** Token de convite: 32 bytes aleatorios, impossivel de adivinhar. */
function newToken() {
  return randomBytes(32).toString("base64url");
}

const inviteSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  role: z.enum(ROLES, { message: "Papel inválido." }),
});

function revalidateTeam() {
  revalidatePath("/configuracoes");
  revalidatePath("/", "layout");
}

/** Quantos administradores (owner) a empresa tem hoje. */
async function ownerCount(companyId: string) {
  return db.membership.count({ where: { companyId, role: "owner" } });
}

/* -------------------------------------------------------------------------- */
/* Convites                                                                    */
/* -------------------------------------------------------------------------- */

export async function inviteMemberAction(
  _state: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const gate = await permit("team.manage");
  if (!gate.ok) return { error: gate.error };

  const parsed = inviteSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    role: String(formData.get("role") ?? "staff").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Ja e da casa? Entao nao ha o que convidar.
  const existing = await db.membership.findFirst({
    where: { companyId: gate.company.id, user: { email: parsed.data.email } },
    select: { id: true },
  });
  if (existing) return { error: "Essa pessoa já faz parte desta empresa." };

  // Um convite pendente por e-mail: o novo substitui o anterior, para nao
  // deixarem dois links validos circulando.
  await db.invitation.updateMany({
    where: { companyId: gate.company.id, email: parsed.data.email, status: "pendente" },
    data: { status: "revogado" },
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_DAYS);

  const invitation = await db.invitation.create({
    data: {
      companyId: gate.company.id,
      email: parsed.data.email,
      role: parsed.data.role,
      token: newToken(),
      expiresAt,
      invitedById: gate.user.id,
    },
    select: { token: true },
  });

  revalidateTeam();
  // O token volta para a tela montar o link que o administrador vai copiar.
  return { ok: true, token: invitation.token };
}

export async function revokeInvitationAction(
  _state: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const gate = await permit("team.manage");
  if (!gate.ok) return { error: gate.error };

  const id = String(formData.get("invitationId") ?? "");
  const invitation = await db.invitation.findFirst({
    where: { id, companyId: gate.company.id, status: "pendente" },
    select: { id: true },
  });
  if (!invitation) return { error: "Convite não encontrado nesta empresa." };

  await db.invitation.update({ where: { id: invitation.id }, data: { status: "revogado" } });

  revalidateTeam();
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Aceitar convite                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Busca o convite pelo token e diz se ele ainda vale.
 *
 * Usada pela pagina publica /convite/[token]. Nao autentica ninguem: so
 * descreve o convite para a tela decidir o que mostrar.
 */
export async function readInvitation(token: string) {
  if (!token) return null;

  const invitation = await db.invitation.findUnique({
    where: { token },
    include: {
      company: { select: { id: true, name: true } },
      invitedBy: { select: { name: true } },
    },
  });
  if (!invitation) return null;

  const expired = invitation.expiresAt < new Date();
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    companyName: invitation.company.name,
    invitedByName: invitation.invitedBy?.name ?? null,
    expiresAt: invitation.expiresAt,
    expired,
    usable: invitation.status === "pendente" && !expired,
  };
}

const acceptSchema = z.object({
  token: z.string().min(10, "Convite inválido."),
  mode: z.enum(["sessao", "entrar", "criar"]),
  name: z.string(),
  password: z.string(),
});

/**
 * Aceita o convite e cria o Membership.
 *
 * O token do formulario nao e uma credencial de confianca: ele so identifica o
 * convite. Tudo o que decide o acesso — validade, status, empresa, papel e a
 * identidade de quem aceita — e resolvido aqui, no servidor.
 *
 * Tres caminhos, todos terminando no mesmo Membership:
 *   sessao — ja esta logado (o e-mail da conta precisa ser o do convite);
 *   entrar — informa e-mail/senha de uma conta existente;
 *   criar  — cria a conta com o e-mail do convite.
 */
export async function acceptInvitationAction(
  _state: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const parsed = acceptSchema.safeParse({
    token: String(formData.get("token") ?? "").trim(),
    mode: String(formData.get("mode") ?? "sessao").trim(),
    name: String(formData.get("name") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const invitation = await db.invitation.findUnique({
    where: { token: parsed.data.token },
    select: {
      id: true,
      companyId: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
    },
  });

  // Recusa generica: nao conta se o token existe, so expirou ou ja foi usado
  // quando isso nao ajuda quem tem o link legitimo.
  if (!invitation) return { error: "Convite inválido." };
  if (invitation.status === "aceito") return { error: "Este convite já foi utilizado." };
  if (invitation.status !== "pendente") return { error: "Este convite não está mais válido." };
  if (invitation.expiresAt < new Date()) return { error: "Este convite expirou." };

  let userId: string | null = null;

  if (parsed.data.mode === "sessao") {
    const session = await readSession();
    if (!session) return { error: "Sua sessão expirou. Entre novamente." };
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true },
    });
    if (!user) return { error: "Sua sessão expirou. Entre novamente." };
    if (user.email !== invitation.email) {
      return { error: `Este convite foi enviado para ${invitation.email}.` };
    }
    userId = user.id;
  }

  if (parsed.data.mode === "entrar") {
    if (parsed.data.password.length === 0) return { error: "Informe sua senha." };
    const user = await db.user.findUnique({
      where: { email: invitation.email },
      select: { id: true, passwordHash: true },
    });
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return { error: "E-mail ou senha incorretos." };
    }
    userId = user.id;
  }

  if (parsed.data.mode === "criar") {
    if (parsed.data.name.length < 2) return { error: "Informe seu nome." };
    if (parsed.data.password.length < 8) {
      return { error: "A senha precisa ter ao menos 8 caracteres." };
    }
    const taken = await db.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });
    if (taken) return { error: "Já existe uma conta com esse e-mail. Use a opção de entrar." };

    // Conta nova nasce sem empresa propria: o convite e que dá o acesso.
    const created = await db.user.create({
      data: {
        name: parsed.data.name,
        email: invitation.email,
        passwordHash: await hashPassword(parsed.data.password),
      },
      select: { id: true },
    });
    userId = created.id;
  }

  if (!userId) return { error: "Não foi possível validar o convite." };

  // O Membership e o mesmo de sempre. `upsert` porque a pessoa pode ter sido
  // convidada de novo depois de sair da empresa.
  await db.membership.upsert({
    where: { userId_companyId: { userId, companyId: invitation.companyId } },
    create: { userId, companyId: invitation.companyId, role: invitation.role },
    update: { role: invitation.role },
  });

  // Marca como aceito ANTES de redirecionar: o link nao serve duas vezes.
  await db.invitation.update({
    where: { id: invitation.id },
    data: { status: "aceito", acceptedAt: new Date(), acceptedById: userId },
  });

  await createSessionCookie({ userId, companyId: invitation.companyId });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/* -------------------------------------------------------------------------- */
/* Papel e remocao                                                             */
/* -------------------------------------------------------------------------- */

export async function changeMemberRoleAction(
  _state: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const gate = await permit("team.manage");
  if (!gate.ok) return { error: gate.error };

  const membershipId = String(formData.get("membershipId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!isRole(role)) return { error: "Papel inválido." };

  // O vinculo precisa ser DESTA empresa.
  const membership = await db.membership.findFirst({
    where: { id: membershipId, companyId: gate.company.id },
    select: { id: true, role: true, userId: true },
  });
  if (!membership) return { error: "Membro não encontrado nesta empresa." };

  if (membership.role === role) return { ok: true };

  // Rebaixar o ultimo administrador deixaria a empresa sem ninguem capaz de
  // gerir equipe e configuracoes — inclusive de desfazer isso.
  if (membership.role === "owner" && role !== "owner") {
    if ((await ownerCount(gate.company.id)) <= 1) {
      return {
        error: "Esta empresa ficaria sem administrador. Promova outra pessoa antes.",
      };
    }
  }

  await db.membership.update({ where: { id: membership.id }, data: { role } });

  revalidateTeam();
  return { ok: true };
}

export async function removeMemberAction(
  _state: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const gate = await permit("team.manage");
  if (!gate.ok) return { error: gate.error };

  const membershipId = String(formData.get("membershipId") ?? "");
  const membership = await db.membership.findFirst({
    where: { id: membershipId, companyId: gate.company.id },
    select: { id: true, role: true, userId: true },
  });
  if (!membership) return { error: "Membro não encontrado nesta empresa." };

  if (membership.role === "owner" && (await ownerCount(gate.company.id)) <= 1) {
    return { error: "Esta empresa ficaria sem administrador. Promova outra pessoa antes." };
  }

  // Some o vinculo com ESTA empresa e nada mais: a conta do usuario continua,
  // o historico do que ele fez continua, e os acessos dele a outras empresas
  // continuam intactos.
  await db.membership.delete({ where: { id: membership.id } });

  revalidateTeam();
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Nova empresa                                                                */
/* -------------------------------------------------------------------------- */

const companySchema = z.object({
  name: z.string().min(2, "Informe o nome da empresa."),
});

/**
 * Cria uma segunda empresa para quem ja usa a plataforma.
 *
 * Nasce vazia e isolada: nenhum dado da empresa atual e copiado. Quem cria
 * entra como owner e a sessao passa a apontar para ela.
 */
export async function createCompanyAction(
  _state: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const gate = await permit("company.create");
  if (!gate.ok) return { error: gate.error };

  const parsed = companySchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const base = slugify(parsed.data.name) || "empresa";
  let slug = base;
  let attempt = 1;
  while (await db.company.findUnique({ where: { slug } })) {
    slug = `${base}-${++attempt}`;
  }

  const company = await db.company.create({
    data: {
      name: parsed.data.name,
      slug,
      memberships: { create: { userId: gate.user.id, role: "owner" } },
    },
    select: { id: true },
  });

  await createSessionCookie({ userId: gate.user.id, companyId: company.id });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
