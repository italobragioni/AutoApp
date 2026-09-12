# ORCAIA

**Plataforma de geracao de orcamentos para prestadores de servico.**

Nichos suportados nesta base: **Vidracaria**, **Serralheria** e **Marcenaria**.

> Etapa 1 — **arquitetura base**. Esta versao entrega o alicerce profissional,
> escalavel e multiempresa, com o schema, a autenticacao segura, o isolamento
> por empresa, o motor de precificacao e o esqueleto navegavel das telas. Os
> CRUDs completos e a criacao de orcamentos entram nas proximas etapas.

Este projeto vive na pasta `orcaia/` e e **independente** do AutoVolt (na raiz do
repositorio) — nenhum arquivo do AutoVolt e compartilhado ou alterado.

---

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
npm run migrate:new         # cria a primeira migration a partir do schema
npm run dev                 # http://localhost:3000
```

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
                                    LaborRate, PriceTable, Quote ...
```

- Um usuario acessa uma empresa **somente** via `Membership` (`owner | manager | staff`).
- A sessao guarda `userId + companyId`; **toda** query e escopada por `companyId`.
- `getCurrentContext()` / `requireContext()` (`src/lib/core/tenant.ts`) revalidam
  a cada request se o usuario ainda e membro da empresa da sessao.
- `src/middleware.ts` e a primeira barreira das rotas protegidas.

### Camadas

```
src/
├── app/
│   ├── (marketing)/          landing publica
│   ├── (auth)/               login, cadastro
│   ├── (app)/                area logada (sidebar + telas)
│   │   ├── dashboard/  clientes/  catalogo/
│   │   ├── precos/     orcamentos/ configuracoes/
│   └── actions/              Server Actions (auth, empresa)
├── components/
│   ├── nav/                  sidebar + seletor de empresa
│   └── ui/                   design system minimo
└── lib/
    ├── core/                 db, session, password, tenant, permissions, format
    ├── niches/               configuracao declarativa por nicho
    ├── pricing/              motor de precificacao (puro)
    └── validation/           schemas Zod
```

### Preparado para os 3 nichos

Um **nucleo unico + configuracao declarativa por nicho** (`src/lib/niches/`).
Cada nicho descreve unidades, campos do item (`spec`) e como derivar a
quantidade. Os atributos especificos vao em colunas **JSON (`spec`)** de
`Product` e `QuoteItem`, sem poluir o schema. Adicionar um 4o nicho = adicionar
um objeto de configuracao; o nucleo nao muda.

### Motor de precificacao

`src/lib/pricing/` recebe **materiais + mao de obra + custos adicionais +
quantidade + margem** e devolve o preco com detalhamento. E puro e independente
de nicho: o que muda entre nichos sao apenas os inputs.

## Previsto para etapas futuras (nao implementado nesta base)

O schema ja esta preparado para receber, sem retrabalho:

- **Cobranca / assinatura** por empresa (controle de acesso por plano).
- **API REST `/api/v1`** autenticada por token por empresa (`ApiToken`), para a
  **extensao Chrome no WhatsApp Web** transformar mensagens em orcamentos.

Convencoes: dinheiro sempre em **centavos**; percentuais em **pontos-base**;
toda query escopada por `companyId`.
