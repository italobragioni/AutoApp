import "server-only";

import { db } from "@/lib/db";

/**
 * Estatísticas do WhatsApp Automático — sempre escopadas por companyId.
 *
 * "Clientes recuperados" usa apenas dados reais: um cliente que recebeu uma
 * automação de retenção e depois teve uma OS concluída dentro da janela de
 * atribuição da empresa. Nunca inventa receita.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RETENTION_TYPES = ["risco", "inativo"];

export type WhatsAppStats = {
  today: { processed: number; sent: number; failed: number };
  period: {
    contactedCustomers: number;
    remindersSent: number;
    retentionSent: number;
    postServiceSent: number;
  };
  recoveredCustomers: number;
};

export async function getWhatsAppStats(
  companyId: string,
  attributionWindowDays: number,
  now: Date = new Date(),
): Promise<WhatsAppStats> {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayRows, monthSent, retentionSent] = await Promise.all([
    db.whatsAppMessage.findMany({
      where: { companyId, createdAt: { gte: startOfToday } },
      select: { status: true },
    }),
    db.whatsAppMessage.findMany({
      where: { companyId, status: "sent", sentAt: { gte: startOfMonth } },
      select: { customerId: true, automationType: true },
    }),
    // Para "recuperados": envios de retenção com data, em qualquer período
    // relevante (janela de atribuição a partir de agora para trás).
    db.whatsAppMessage.findMany({
      where: {
        companyId,
        status: "sent",
        automationType: { in: RETENTION_TYPES },
        sentAt: { gte: new Date(now.getTime() - (attributionWindowDays + 90) * MS_PER_DAY) },
      },
      select: { customerId: true, sentAt: true },
    }),
  ]);

  const today = {
    processed: todayRows.length,
    sent: todayRows.filter((r) => r.status === "sent").length,
    failed: todayRows.filter((r) => r.status === "failed").length,
  };

  const contacted = new Set(monthSent.map((r) => r.customerId));
  const period = {
    contactedCustomers: contacted.size,
    remindersSent: monthSent.filter((r) => r.automationType === "lembrete").length,
    retentionSent: monthSent.filter((r) => RETENTION_TYPES.includes(r.automationType)).length,
    postServiceSent: monthSent.filter((r) => r.automationType === "pos_servico").length,
  };

  // Recuperados: recebeu retenção → depois concluiu uma OS dentro da janela.
  let recoveredCustomers = 0;
  if (retentionSent.length > 0) {
    const customerIds = [...new Set(retentionSent.map((r) => r.customerId))];
    const orders = await db.workOrder.findMany({
      where: { companyId, status: "concluida", customerId: { in: customerIds } },
      select: { customerId: true, finishedAt: true },
    });
    const earliestContact = new Map<string, number>();
    for (const r of retentionSent) {
      if (!r.sentAt) continue;
      const t = r.sentAt.getTime();
      const prev = earliestContact.get(r.customerId);
      if (prev === undefined || t < prev) earliestContact.set(r.customerId, t);
    }
    const recovered = new Set<string>();
    for (const order of orders) {
      if (!order.finishedAt) continue;
      const contactAt = earliestContact.get(order.customerId);
      if (contactAt === undefined) continue;
      const done = order.finishedAt.getTime();
      if (done >= contactAt && done <= contactAt + attributionWindowDays * MS_PER_DAY) {
        recovered.add(order.customerId);
      }
    }
    recoveredCustomers = recovered.size;
  }

  return { today, period, recoveredCustomers };
}
