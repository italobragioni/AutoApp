/**
 * Seed do AUTOVOLT.
 *
 * Cria DUAS empresas para deixar evidente que a plataforma e multi-empresa e
 * que os dados sao isolados: o usuario demo tem acesso as duas e pode alternar
 * pelo seletor no topo da aplicacao.
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { seedDemoDataForCompany } from "../src/lib/demo-data";
import { slugify } from "../src/lib/slug";

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

  // Um segundo usuario, apenas da empresa principal — demonstra multiusuario.
  await db.user.create({
    data: {
      name: "Tainá Ribeiro",
      email: "taina.ribeiro@garage77.com.br",
      passwordHash,
      avatarColor: "#38BDF8",
      memberships: { create: [{ companyId: primary.id, role: "manager" }] },
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
  console.log(`Usuário: ${owner.name} — com acesso a 2 empresas.\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
