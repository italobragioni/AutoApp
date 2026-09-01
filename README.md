# AUTOVOLT

**Organize sua estética e faça seus clientes voltarem automaticamente.**

Plataforma SaaS de gestão e crescimento para **estética automotiva, detalhamento
automotivo, lava-rápidos premium e serviços de cuidados automotivos**.

O AUTOVOLT não é um ERP genérico. A diferença está no **motor de retenção**: em vez
de apenas registrar o que já aconteceu, ele lê o histórico de cada cliente e responde
a pergunta que define o faturamento de uma estética — *quem deveria estar voltando
agora e não voltou?*

---

## Acesso de demonstração

```
e-mail: demo@autovolt.com.br
senha:  autovolt123
```

O usuário de demonstração tem acesso a **duas empresas** (Garage 77 Estética
Automotiva e Lumen Detail Studio), para deixar visível o isolamento de dados e a
troca de empresa pelo seletor no topo.

## Como rodar

Requer um PostgreSQL local (ou um banco de desenvolvimento à parte).

```bash
npm install
cp .env.example .env      # aponte DATABASE_URL para o banco local e defina AUTH_SECRET
npm run setup             # aplica as migrations e popula os dados de demonstração
npm run dev               # http://localhost:3000
```

Scripts disponíveis:

| Script | O que faz |
| --- | --- |
| `npm run dev` | Ambiente de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run setup` | Aplica migrations e popula dados de demonstração (uso local) |
| `npm run migrate:new` | Cria uma nova migration a partir do schema alterado |
| `npm run migrate:deploy` | Aplica migrations pendentes (não destrutivo) |
| `npm run migrate:status` | Mostra quais migrations já foram aplicadas |
| `npm run db:seed` | **Apaga tudo** e repopula os dados fictícios — só em ambiente local |
| `npm run typecheck` | Verificação de tipos |
| `npm run smoke` | Smoke test end-to-end (requer o servidor rodando) |

> **`db:seed` é destrutivo por natureza.** Ele limpa a base antes de popular, então
> existe apenas como ferramenta de desenvolvimento. O script se recusa a rodar na
> Vercel, com `NODE_ENV=production` ou contra um banco remoto — neste último caso
> exige `ALLOW_REMOTE_SEED=1` explicitamente. Nenhum build ou deploy o executa.

## Stack

- **Next.js 15** (App Router, Server Components e Server Actions)
- **TypeScript** em modo estrito
- **Tailwind CSS** com design system próprio
- **Prisma** + SQLite em desenvolvimento (pronto para PostgreSQL)
- Autenticação própria: **bcrypt** + sessão JWT (`jose`) em cookie `httpOnly`
- Ícones **lucide-react**; gráficos em **SVG puro**, sem biblioteca de charts
- Fontes **Inter** e **Sora** auto-hospedadas — o build não depende de rede

---

## Arquitetura multi-empresa

O sistema já nasce preparado para múltiplos usuários e múltiplas empresas.

```
User ──< Membership >── Company ──< Customer, Vehicle, ServiceItem,
                                    Appointment, Quote, WorkOrder, Campaign
```

- Um usuário acessa uma empresa **somente** através de um `Membership`
  (`owner` | `manager` | `staff`).
- A sessão guarda `userId` + `companyId`. **Toda** consulta da aplicação é
  escopada por `companyId`.
- `getCurrentContext()` (em `src/lib/tenant.ts`) revalida a cada requisição se o
  usuário ainda é membro da empresa da sessão — um cookie antigo não continua
  dando acesso a dados de outro tenant.
- Rotas dinâmicas usam `findFirst({ where: { id, companyId } })`: um registro de
  outra empresa simplesmente **não existe** e responde `404`.

O `npm run smoke` verifica esse isolamento automaticamente.

### Camadas

```
src/
├── app/
│   ├── (marketing)/        landing page pública
│   ├── (auth)/             login e cadastro
│   ├── (app)/              área logada (sidebar + menu mobile)
│   └── actions/            Server Actions (auth, empresa)
├── components/
│   ├── brand/              logo AUTOVOLT
│   ├── nav/                sidebar, topbar e menu inferior
│   ├── charts/             gráficos em SVG
│   └── ui/                 design system
├── lib/
│   ├── tenant.ts           contexto e isolamento por empresa
│   ├── session.ts          sessão JWT em cookie
│   ├── retention.ts        motor de retenção
│   ├── metrics.ts          agregações de dashboard e relatórios
│   └── demo-data.ts        gerador de dados fictícios
└── middleware.ts           primeira barreira das rotas protegidas
```

---

## O motor de retenção

Coração do produto (`src/lib/retention.ts`). Para cada cliente ele calcula:

1. **Último serviço concluído** e há quantos dias foi.
2. **Ciclo de retorno** — vem da recorrência do serviço contratado (cada item do
   catálogo tem `recurrenceDays`); sem recorrência definida, vale o padrão da
   empresa, ajustável em Configurações.
3. **Data ideal de retorno** e quantos dias está atrasado.
4. **Estágio**, com uma régua transparente exibida na própria tela:

| Estágio | Significado |
| --- | --- |
| **Novo** | Ainda sem histórico de serviço concluído |
| **Em dia** | Dentro do ciclo ideal de retorno |
| **Atenção** | Passou do ciclo — bom momento para um lembrete |
| **Em risco** | Mais de 30 dias de atraso — contato agora evita a perda |
| **Inativo** | Sem retorno há mais que o limite da empresa |

Disso saem: a **receita recuperável** (ticket médio histórico de cada cliente
atrasado), as listas de prioridade de contato com **mensagem sugerida e link
direto de WhatsApp**, e os **públicos prontos** usados em Campanhas.

---

## Páginas

| Menu | O que entrega |
| --- | --- |
| **Dashboard** | Faturamento, ticket médio, agenda do dia, OS em andamento e quem contatar hoje |
| **Agenda** | Grade semanal navegável, valor agendado e horas de box comprometidas |
| **Clientes** | Busca, filtro por estágio de retenção e ficha completa por cliente |
| **Veículos** | Carros por dono, porte, placa e receita gerada |
| **Serviços** | Catálogo com preço, duração, ciclo de recorrência e desempenho de venda |
| **Orçamentos** | Funil visual (rascunho → enviado → aprovado) e controle de validade |
| **Ordens de Serviço** | Quadro operacional do pátio e histórico completo |
| **Retenção** | Motor de retenção, receita recuperável e listas de contato |
| **Campanhas** | Públicos calculados ao vivo, mensagens e resultado (conversão e receita) |
| **Relatórios** | Faturamento 12 meses, serviços que mais faturam, origem e recompra |
| **Configurações** | Dados da empresa, regras de retenção, usuários e isolamento |

### Uma nota sobre métricas do mês corrente

O mês em andamento é comparado com o **mesmo intervalo de dias** do mês anterior
(dia 1 até hoje), e não com o mês anterior fechado. Sem isso, todo dia 1º o painel
mostraria uma queda enorme. As telas também sinalizam quando o mês ainda está em
andamento.

---

## Dados de demonstração

`npm run db:seed` popula duas empresas com histórico realista, incluindo os
clientes e veículos pedidos:

- **Clientes**: João Silva, Carlos Oliveira, Marcos Santos, Ricardo Alves,
  Fernanda Lima, Patrícia Nunes, Eduardo Moreira, Bruno Carvalho, Luciana Prado,
  André Ferreira, Rafael Castro e Juliana Rocha.
- **Veículos**: Honda Civic, BMW 320i, Volkswagen Jetta, Toyota Corolla, Jeep
  Compass, Hyundai HB20, Audi A4, Chevrolet Onix, Fiat Argo, Volvo XC60, Toyota
  Hilux, Honda HR-V e Renault Kwid.

O histórico é gerado **de propósito** com clientes em estágios diferentes de
retenção — em dia, em atenção, em risco e inativos — para que as telas de
Retenção, Campanhas e Relatórios já contem uma história real de oportunidade.

No cadastro de uma nova empresa é possível marcar *"popular com dados de
demonstração"* para receber a mesma base.

---

## Banco de dados e deploy

PostgreSQL com **migrations versionadas**. O banco de produção nunca é apagado
nem resetado por um deploy.

### O fluxo completo

```
1. Local     alterar prisma/schema.prisma
2. Local     npm run migrate:new      -> gera prisma/migrations/<timestamp>_nome/
3. Git       commitar a migration junto com o código
4. Vercel    o build roda scripts/db-deploy.mjs
5. Produção  aplica apenas as migrations pendentes; dados permanecem
```

O comando de build é:

```
prisma generate && node scripts/db-deploy.mjs && next build
```

`scripts/db-deploy.mjs` só cria estrutura — nunca apaga nem altera dados:

- **Banco vazio** → aplica todas as migrations e cria o schema.
- **Banco com tabelas mas sem histórico de migrations** → registra `0_init` como
  baseline (sem executar o SQL, porque as tabelas já existem) e segue.
- **Banco já versionado** → aplica só o que estiver pendente.

O baseline existe porque a base de produção nasceu de um `prisma db push`
anterior às migrations. Sem ele, `prisma migrate deploy` abortaria com `P3005`
e o deploy quebraria.

### Regras de segurança

- Nenhum build ou deploy executa o seed.
- Nenhum script usa `--force-reset`, `--accept-data-loss` ou `migrate reset`.
- `prisma db push` não é usado em lugar nenhum — apenas migrations versionadas.
- O seed tem trava própria: aborta na Vercel, aborta com `NODE_ENV=production`
  e exige `ALLOW_REMOTE_SEED=1` para bancos remotos.

Valores monetários são guardados em **centavos** (inteiros), evitando erro de
ponto flutuante.

---

## Próximos passos

A base está pronta; estes são os incrementos naturais:

- Formulários de criação/edição para clientes, veículos, agendamentos,
  orçamentos e ordens de serviço (as telas de listagem e leitura já estão feitas).
- Convite de usuários por e-mail (papéis e permissões já existem no banco).
- Disparo real das campanhas via API de WhatsApp.
- Conversão de orçamento aprovado em ordem de serviço com um clique.
- Exportação de relatórios em PDF/CSV.
