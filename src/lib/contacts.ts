import "server-only";

import { db } from "@/lib/db";
import { daysBetween } from "@/lib/format";
import { CONTACT_CHANNEL, CONTACT_OUTCOME } from "@/lib/labels";
import type { RetentionCustomer, RetentionStage, RetentionSummary } from "@/lib/retention";

/**
 * Memoria de contato da fila de retencao.
 *
 * O motor de retencao (src/lib/retention.ts) responde "em que estagio esse
 * cliente esta?" e continua respondendo exatamente a mesma coisa — nada aqui
 * altera estagio, ciclo ou calculo dele.
 *
 * O que faltava era a outra metade da pergunta: "eu ja falei com ele?". Sem
 * isso o mesmo cliente reaparece como prioridade todo dia. Este modulo le os
 * contatos registrados (ContactLog) e devolve a fila ja ordenada, separando
 * quem precisa de contato AGORA de quem acabou de ser contatado e esta em
 * periodo de espera (cooldown).
 *
 * Regra do cooldown: proximo contato recomendado = ultimo contato + N dias,
 * onde N e `Company.contactCooldownDays` (padrao 7). Passado esse prazo, se o
 * cliente nao voltou, ele reaparece na prioridade sozinho — porque o estagio
 * dele nunca deixou de ser calculado.
 */

export const CONTACT_CHANNELS = Object.keys(CONTACT_CHANNEL);
export const CONTACT_OUTCOMES = Object.keys(CONTACT_OUTCOME);

/** Estagios que entram na fila de contato. Mesmo conjunto do `needsContactCount`. */
const NEEDS_CONTACT: RetentionStage[] = ["em_risco", "inativo", "atencao"];

export type LastContact = {
  at: Date;
  channel: string;
  outcome: string;
  /** Quem registrou. Null quando o usuario foi removido depois. */
  byName: string | null;
  notes: string | null;
};

export type ContactStatus = {
  last: LastContact | null;
  /** Ultimo contato + cooldown da empresa. Null quando nunca houve contato. */
  nextContactAt: Date | null;
  /** true enquanto `nextContactAt` estiver no futuro. */
  inCooldown: boolean;
  /** Dias que ainda faltam para sair do cooldown (0 quando ja saiu). */
  cooldownDaysLeft: number;
};

export type RetentionCustomerWithContact = RetentionCustomer & { contact: ContactStatus };

export type RetentionBoard = {
  /** O resumo do motor de retencao, intacto. */
  summary: RetentionSummary;
  /** Todos os clientes, na mesma ordem do motor, com o contato anexado. */
  customers: RetentionCustomerWithContact[];
  byStage: Record<RetentionStage, RetentionCustomerWithContact[]>;
  /** Quem passou do ciclo E nao esta em cooldown: a fila de hoje. */
  priority: RetentionCustomerWithContact[];
  /** Quem passou do ciclo mas ja foi contatado ha pouco. */
  inCooldown: RetentionCustomerWithContact[];
  cooldownDays: number;
};

/** Calcula o estado de cooldown a partir do ultimo contato. */
export function contactStatus(
  last: LastContact | null,
  cooldownDays: number,
  now = new Date(),
): ContactStatus {
  if (!last) {
    return { last: null, nextContactAt: null, inCooldown: false, cooldownDaysLeft: 0 };
  }

  const nextContactAt = new Date(last.at.getTime() + cooldownDays * 24 * 60 * 60 * 1000);
  const inCooldown = nextContactAt > now;

  return {
    last,
    nextContactAt,
    inCooldown,
    cooldownDaysLeft: inCooldown ? Math.max(1, daysBetween(now, nextContactAt)) : 0,
  };
}

/**
 * Ultimo contato de cada cliente da empresa.
 * Escopado por companyId como todo o resto — contato de outra empresa nem
 * chega a ser lido.
 */
export async function lastContactByCustomer(companyId: string) {
  const rows = await db.contactLog.findMany({
    where: { companyId },
    orderBy: { contactedAt: "desc" },
    select: {
      customerId: true,
      contactedAt: true,
      channel: true,
      outcome: true,
      notes: true,
      user: { select: { name: true } },
    },
  });

  // A lista vem do mais recente para o mais antigo: o primeiro de cada cliente
  // ja e o ultimo contato dele.
  const map = new Map<string, LastContact>();
  for (const row of rows) {
    if (map.has(row.customerId)) continue;
    map.set(row.customerId, {
      at: row.contactedAt,
      channel: row.channel,
      outcome: row.outcome,
      byName: row.user?.name ?? null,
      notes: row.notes,
    });
  }
  return map;
}

/**
 * Anexa o historico de contato ao resumo do motor de retencao.
 *
 * Recebe o `summary` ja calculado em vez de recalcular: o motor continua sendo
 * a unica fonte do estagio.
 */
export async function attachContacts(
  summary: RetentionSummary,
  companyId: string,
  cooldownDays: number,
  now = new Date(),
): Promise<RetentionBoard> {
  const contacts = await lastContactByCustomer(companyId);

  const customers: RetentionCustomerWithContact[] = summary.customers.map((customer) => ({
    ...customer,
    contact: contactStatus(contacts.get(customer.id) ?? null, cooldownDays, now),
  }));

  const byStage = {
    novo: [],
    em_dia: [],
    atencao: [],
    em_risco: [],
    inativo: [],
  } as Record<RetentionStage, RetentionCustomerWithContact[]>;
  for (const customer of customers) byStage[customer.stage].push(customer);

  // A fila mantem a ordenacao do motor (mais atrasado primeiro); o cooldown so
  // decide de que lado o cliente cai.
  const needsContact = NEEDS_CONTACT.flatMap((stage) => byStage[stage]).sort(
    (a, b) => b.overdueDays - a.overdueDays || b.opportunityCents - a.opportunityCents,
  );

  return {
    summary,
    customers,
    byStage,
    priority: needsContact.filter((customer) => !customer.contact.inCooldown),
    // Quem sai antes do cooldown acabar aparece primeiro.
    inCooldown: needsContact
      .filter((customer) => customer.contact.inCooldown)
      .sort(
        (a, b) =>
          (a.contact.nextContactAt?.getTime() ?? 0) - (b.contact.nextContactAt?.getTime() ?? 0),
      ),
    cooldownDays,
  };
}
