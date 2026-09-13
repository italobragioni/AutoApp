// Aplica as migrations no build de forma robusta.
//
// As migrations (prisma migrate deploy) PRECISAM usar a conexao DIRETA do banco,
// nao a "pooled" (pgbouncer). Na conexao pooled o Prisma nao consegue segurar o
// "advisory lock" usado para migrar e o build falha com P1002 (timeout ao
// adquirir o lock). Este script:
//   1. escolhe uma URL direta explicita se existir (DATABASE_URL_UNPOOLED /
//      POSTGRES_URL_NON_POOLING);
//   2. senao, deriva a URL direta a partir da DATABASE_URL (remove "-pooler" do
//      host do Neon e o parametro pgbouncer);
//   3. garante um connect_timeout generoso (Neon "hiberna" e leva alguns
//      segundos para acordar na primeira conexao);
//   4. tenta novamente algumas vezes em caso de timeout / cold start.
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

/**
 * Transforma uma URL "pooled" numa URL DIRETA, adequada para migrations:
 *  - remove o sufixo "-pooler" do host (padrao Neon);
 *  - remove o parametro pgbouncer;
 *  - garante sslmode=require e um connect_timeout generoso.
 */
function toDirectUrl(raw) {
  try {
    const u = new URL(raw);
    u.hostname = u.hostname.replace(/-pooler\./, ".");
    u.searchParams.delete("pgbouncer");
    if (!u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "30");
    return u.toString();
  } catch {
    return raw;
  }
}

const explicitDirect =
  process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;

const base = explicitDirect || process.env.DATABASE_URL;

if (!base) {
  console.error(
    "[db-deploy] Nenhuma variavel de conexao encontrada. Defina DATABASE_URL.",
  );
  process.exit(1);
}

const migrateUrl = toDirectUrl(base);

try {
  const host = new URL(migrateUrl).host;
  const pooled = /-pooler\./.test(host);
  console.log(
    `[db-deploy] Conexao de migracao: ${host}${pooled ? " (ATENCAO: ainda parece pooled)" : " (direta)"}`,
  );
} catch {
  /* ignore */
}

const MAX_ATTEMPTS = 4;
let lastError = null;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  try {
    console.log(
      `[db-deploy] Aplicando migrations (tentativa ${attempt}/${MAX_ATTEMPTS})...`,
    );
    execSync("prisma migrate deploy", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: migrateUrl },
    });
    console.log("[db-deploy] Migrations aplicadas com sucesso.");
    process.exit(0);
  } catch (err) {
    lastError = err;
    console.warn(
      `[db-deploy] Falha na tentativa ${attempt}. Aguardando o banco acordar...`,
    );
    if (attempt < MAX_ATTEMPTS) {
      // Espera crescente: 3s, 6s, 9s — cobre o cold start do Neon.
      execSync(`node -e "setTimeout(()=>{}, ${attempt * 3000})"`);
    }
  }
}

console.error(
  "[db-deploy] Nao foi possivel aplicar as migrations apos varias tentativas.",
);
if (lastError) console.error(String(lastError.message || lastError));
process.exit(1);
