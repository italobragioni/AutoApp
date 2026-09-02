/**
 * Seed do AUTOVOLT — FERRAMENTA DE DESENVOLVIMENTO.
 *
 * ATENCAO: este script APAGA TODOS OS DADOS antes de popular. Ele existe para
 * montar um ambiente local de demonstracao, nunca para rodar em producao.
 *
 * Por isso ele NAO e chamado por nenhum build ou deploy, e as travas abaixo
 * impedem execucao acidental contra um banco real. Uso previsto:
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { seedDemoDataForCompany } from "../src/lib/demo-data";
import { slugify } from "../src/lib/slug";

/**
 * Trava de seguranca.
 *
 * Roda ANTES de qualquer conexao com o banco e aborta o processo se houver
 * qualquer sinal de ambiente real. Sao tres camadas:
 *
 *   1. Vercel  -> recusa sempre, sem possibilidade de override. Mesmo que
 *                 alguem religue o seed em um script de build por engano, o
 *                 processo morre aqui antes de apagar qualquer coisa.
 *   2. NODE_ENV=production -> mesma recusa incondicional.
 *   3. Banco remoto -> exige a variavel ALLOW_REMOTE_SEED=1, para o caso
 *                 legitimo de popular um banco de staging de proposito.
 */
function guardAgainstProduction() {
  const url = process.env.DATABASE_URL ?? "";

  if (process.env.VERCEL) {
    console.error(
      "\n✖ Seed bloqueado: detectado ambiente Vercel.\n" +
        "  Este script apaga todos os dados e nunca deve rodar em deploy.\n",
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production") {
    console.error(
      "\n✖ Seed bloqueado: NODE_ENV=production.\n" +
        "  Este script apaga todos os dados e e apenas para desenvolvimento.\n",
    );
    process.exit(1);
  }

  if (!url) {
    console.error("\n✖ DATABASE_URL nao definida.\n");
    process.exit(1);
  }

  const isLocal =
    url.startsWith("file:") ||
    url.includes("localhost") ||
    url.includes("127.0.0.1");

  if (!isLocal && process.env.ALLOW_REMOTE_SEED !== "1") {
    const host = url.replace(/\/\/[^@]*@/, "//***@").slice(0, 90);
    console.error(
      "\n✖ Seed bloqueado: DATABASE_URL aponta para um banco remoto.\n" +
        `  Destino: ${host}...\n\n` +
        "  Isto APAGARIA todos os dados desse banco.\n" +
        "  Se for realmente intencional (ex.: staging), rode com:\n" +
        "    ALLOW_REMOTE_SEED=1 npm run db:seed\n",
    );
    process.exit(1);
  }

  if (!isLocal) {
    console.warn(
      "\n⚠  ALLOW_REMOTE_SEED=1: apagando e repovoando um banco REMOTO.\n",
    );
  }
}

guardAgainstProduction();

const db = new PrismaClient();

const DEMO_EMAIL = "demo@autovolt.com.br";
const DEMO_PASSWORD = "autovolt123";

async function reset() {
  // Ordem importa por causa das FKs.
  await db.appointmentService.deleteMany();
  await db.quoteItem.deleteMany();
  await db.workOrderItem.deleteMany();
  await db.appointment.deleteMany();
  await db.workOrder.deleteMany();
  await db.quote.deleteMany();
  await db.campaign.deleteMany();
  await db.serviceItem.deleteMany();
  await db.vehicle.deleteMany();
  await db.customer.deleteMany();
  await db.membership.deleteMany();
  await db.company.deleteMany();
  await db.user.deleteMany();
}

async function createCompany(name: string, extra: Record<string, unknown>) {
  return db.company.create({
    data: { name, slug: slugify(name), ...extra },
  });
}

async function main() {
  console.log("→ Limpando base...");
  await reset();

  console.log("→ Criando empresas...");
  const primary = await createCompany("Garage 77 Estética Automotiva", {
    document: "12.345.678/0001-90",
    phone: "1140028922",
    email: "contato@garage77.com.br",
    city: "São Paulo",
    state: "SP",
    address: "Av. Brigadeiro Faria Lima, 1234",
    plan: "pro",
    retentionWindowDays: 90,
    inactiveAfterDays: 180,
  });

  const secondary = await createCompany("Lumen Detail Studio", {
    phone: "1130041515",
    email: "contato@lumendetail.com.br",
    city: "Campinas",
    state: "SP",
    plan: "starter",
    retentionWindowDays: 75,
    inactiveAfterDays: 150,
  });

  console.log("→ Criando usuários...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const owner = await db.user.create({
    data: {
      name: "Ítalo Bragioni",
      email: DEMO_EMAIL,
      passwordHash,
      avatarColor: "#12E29B",
      memberships: {
        create: [
          { companyId: primary.id, role: "owner" },
          { companyId: secondary.id, role: "owner" },
        ],
      },
    },
  });

  // Equipe da empresa principal, com os tres papeis representados. Serve para
  // ver na pratica o que cada um alcanca — entrando com cada e-mail abaixo, a
  // mesma plataforma mostra menus e acoes diferentes.
  await db.user.create({
    data: {
      name: "Tainá Ribeiro",
      email: "taina.ribeiro@garage77.com.br",
      passwordHash,
      avatarColor: "#38BDF8",
      memberships: { create: [{ companyId: primary.id, role: "manager" }] },
    },
  });

  await db.user.create({
    data: {
      name: "Diego Nakamura",
      email: "diego.nakamura@garage77.com.br",
      passwordHash,
      avatarColor: "#FBBF24",
      memberships: { create: [{ companyId: primary.id, role: "staff" }] },
    },
  });

  console.log("→ Gerando dados de demonstração...");
  await seedDemoDataForCompany(primary.id);
  await seedDemoDataForCompany(secondary.id);

  const counts = {
    clientes: await db.customer.count(),
    veiculos: await db.vehicle.count(),
    servicos: await db.serviceItem.count(),
    agendamentos: await db.appointment.count(),
    orcamentos: await db.quote.count(),
    ordens: await db.workOrder.count(),
    campanhas: await db.campaign.count(),
  };

  console.log("\n✔ Seed concluído.");
  console.table(counts);
  console.log(`\nAcesso de demonstração:\n  e-mail: ${DEMO_EMAIL}\n  senha:  ${DEMO_PASSWORD}\n`);
  console.log(`Usuário: ${owner.name} — com acesso a 2 empresas.`);
  console.log("\nEquipe da Garage 77 (mesma senha), para ver os papéis:");
  console.log("  taina.ribeiro@garage77.com.br   — Gerente");
  console.log("  diego.nakamura@garage77.com.br  — Operacional\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
