// Aplica as migrations no build de forma robusta.
//
// As migrations (prisma migrate deploy) devem usar a conexao DIRETA do banco,
// nao a "pooled" (pgbouncer), que pode falhar. Nomes de variavel variam
// conforme a integracao (Neon/Vercel usa DATABASE_URL_UNPOOLED; outras usam
// POSTGRES_URL_NON_POOLING). Este script escolhe a melhor disponivel e cai para
// DATABASE_URL quando nao ha uma direta especifica.
//
// O app em runtime continua usando DATABASE_URL (definido no schema).

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

// Em ambiente local as variaveis ficam no .env (que o `node` nao carrega
// sozinho). Na Vercel elas ja vem no ambiente e nao ha arquivo .env. Entao:
// carregamos o .env SE existir, sem sobrescrever o que ja estiver no ambiente.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    if (process.env[key] !== undefined) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const migrateUrl =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!migrateUrl) {
  console.error(
    "[db-deploy] Nenhuma variavel de conexao encontrada. Defina DATABASE_URL.",
  );
  process.exit(1);
}

console.log("[db-deploy] Aplicando migrations (prisma migrate deploy)...");
execSync("prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: migrateUrl },
});
console.log("[db-deploy] Migrations aplicadas com sucesso.");
