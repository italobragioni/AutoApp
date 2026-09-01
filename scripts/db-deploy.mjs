/**
 * Aplicação de migrations no deploy — AUTOVOLT.
 *
 * Roda no build (Vercel) antes do `next build`. É deliberadamente conservador:
 * só cria estrutura, nunca apaga nem altera dados.
 *
 * Por que não basta chamar `prisma migrate deploy` direto:
 *
 *   O banco de produção nasceu de um `prisma db push`, antes de existirem
 *   migrations versionadas. Ele tem as tabelas, mas não tem a tabela de
 *   controle `_prisma_migrations`. Nesse estado o `migrate deploy` aborta com
 *   P3005 ("The database schema is not empty") e o build inteiro falha.
 *
 *   A saída suportada pelo Prisma é o "baseline": registrar a migration inicial
 *   como já aplicada, SEM executar o SQL dela — porque aquelas tabelas já
 *   existem. É o que este script faz, uma única vez, automaticamente.
 *
 * Estados possíveis e o que acontece em cada um:
 *
 *   banco vazio           -> migrate deploy cria tudo do zero
 *   banco já com tabelas
 *     e sem baseline      -> registra o baseline, depois migrate deploy
 *   banco já com baseline -> apenas migrate deploy (aplica o que estiver pendente)
 *
 * Nenhum caminho executa DROP, TRUNCATE, DELETE, reset ou seed.
 */
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const BASELINE = "0_init";

function runPrisma(args) {
  execFileSync("npx", ["prisma", ...args], { stdio: "inherit" });
}

/** Uma tabela conhecida da aplicação indica que o schema já foi criado antes. */
async function inspect(db) {
  const [{ exists: hasAppTables }] = await db.$queryRaw`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS exists;
  `;

  const [{ exists: hasMigrationsTable }] = await db.$queryRaw`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
    ) AS exists;
  `;

  let baselineRecorded = false;
  if (hasMigrationsTable) {
    const rows = await db.$queryRaw`
      SELECT 1 FROM "_prisma_migrations"
      WHERE migration_name = ${BASELINE} AND finished_at IS NOT NULL
      LIMIT 1;
    `;
    baselineRecorded = rows.length > 0;
  }

  return { hasAppTables, baselineRecorded };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✖ DATABASE_URL não definida — impossível aplicar migrations.");
    process.exit(1);
  }

  const db = new PrismaClient();
  let state;

  try {
    state = await inspect(db);
  } finally {
    await db.$disconnect();
  }

  if (state.hasAppTables && !state.baselineRecorded) {
    console.log(
      `→ Banco já possui tabelas sem controle de migrations.\n` +
        `  Registrando "${BASELINE}" como baseline (não executa SQL, não toca em dados).`,
    );
    runPrisma(["migrate", "resolve", "--applied", BASELINE]);
  }

  console.log("→ Aplicando migrations pendentes (prisma migrate deploy)");
  runPrisma(["migrate", "deploy"]);
  console.log("✔ Banco atualizado. Nenhum dado foi apagado.");
}

main().catch((error) => {
  console.error("✖ Falha ao aplicar migrations:", error?.message ?? error);
  process.exit(1);
});
