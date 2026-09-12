# ORCAIA

**Plataforma de geracao de orcamentos para prestadores de servico.**

Nichos suportados: **Vidraçaria**, **Serralheria** e **Marcenaria**.

Este projeto vive na pasta `orcaia/` e e **independente** do AutoVolt (na raiz do
repositorio) — nenhum arquivo do AutoVolt e compartilhado ou alterado.

## Status

Nucleo funcional, com persistencia real em PostgreSQL (sem dados mockados):

- Cadastro, login, logout (bcrypt + sessao JWT em cookie httpOnly)
- Multiempresa: criar/alternar empresas; **isolamento total por empresa**
- Selecao de nicho na criacao da empresa
- Dashboard com contagens reais
- Clientes (CRUD): nome, CPF/CNPJ, telefone, WhatsApp, e-mail, endereco, observacoes
- Produtos e servicos (CRUD)
- Materiais (CRUD)
- Custos: mao de obra, deslocamento e outros (fixos ou percentuais)
- Configuracao da margem de lucro (e mao de obra padrao)
- Perfil do usuario e troca de senha
- Validacao com Zod, rotas protegidas e tratamento de erros em todas as acoes

Ainda **nao** implementado (previsto para as proximas etapas): montagem de
orcamentos com o motor de precificacao, cobranca/assinatura e a extensao Chrome.
Os modelos correspondentes ja existem no schema.

## Stack

- **Next.js 15** (App Router, Server Components + Server Actions)
- **TypeScript** estrito
- **Prisma + PostgreSQL** — valores em **centavos**, margem em **pontos-base**
- **Tailwind CSS**
- **Zod** para validacao
- Autenticacao propria: **bcrypt** + sessao **JWT (`jose`)** em cookie `httpOnly`

## Como rodar

Requer um PostgreSQL acessivel.

```bash
cd orcaia
npm install
cp .env.example .env        # defina DATABASE_URL e AUTH_SECRET
npm run migrate:deploy      # aplica as migrations versionadas
npm run dev                 # http://localhost:3000
```

Em desenvolvimento, para criar novas migrations a partir de mudancas no schema:
`npm run migrate:new`.

| Script | O que faz |
| --- | --- |
| `npm run dev` | Ambiente de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de producao |
| `npm run migrate:new` | Cria/aplica migration a partir do schema alterado |
| `npm run migrate:deploy` | Aplica migrations pendentes (nao destrutivo) |
| `npm run typecheck` | Verificacao de tipos |

## Arquitetura

### Multiempresa (multi-tenant)

```
User ──< Membership >── Company ──< Customer, Material, Product,
                                    LaborRate, AdditionalCost, PriceTable, Quote ...
```

- Um usuario acessa uma empresa **somente** via `Membership` (`owner | manager | staff`).
- A sessao guarda `userId + companyId`; **toda** query e escopada por `companyId`.
- `getCurrentContext()` / `requireContext()` (`src/lib/core/tenant.ts`) revalidam
  a cada request se o usuario ainda e membro da empresa da sessao.
- Escritas usam `updateMany` / `deleteMany` com `where: { id, companyId }`, e
  leituras dinamicas usam `findFirst({ where: { id, companyId } })`: um registro
  de outra empresa simplesmente **nao existe** (404).
- `src/middleware.ts` e a primeira barreira das rotas protegidas.

### Camadas

```
src/
├── app/
│   ├── (marketing)/          landing publica
│   ├── (auth)/               login, cadastro
│   ├── (app)/                area logada (sidebar + telas)
│   │   ├── dashboard/  clientes/  produtos/  materiais/  custos/  configuracoes/
│   └── actions/              Server Actions (auth, empresa, clientes, catalogo, settings)
├── components/
│   ├── nav/                  sidebar responsiva + seletor de empresa
│   ├── forms/                formularios (client) com useActionState
│   └── ui/                   design system minimo
└── lib/
    ├── core/                 db, session, password, tenant, permissions, money, actions
    ├── niches/               configuracao declarativa por nicho
    ├── pricing/              motor de precificacao (puro; usado nas proximas etapas)
    └── validation/           schemas Zod
```

### Preparado para os 3 nichos

Um **nucleo unico + configuracao declarativa por nicho** (`src/lib/niches/`).
Cada nicho descreve unidades, campos do item (`spec`) e como derivar a
quantidade. Os atributos especificos vao em colunas **JSON (`spec`)** de
`Product` e `QuoteItem`. Adicionar um 4o nicho = adicionar um objeto de
configuracao; o nucleo nao muda.

Convencoes: dinheiro sempre em **centavos**; percentuais em **pontos-base**;
toda query escopada por `companyId`.
