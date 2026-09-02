import { db } from "@/lib/db";

/**
 * Dados ficticios de demonstracao.
 *
 * Usado pelo seed (`npm run db:seed`) e, opcionalmente, no cadastro de uma nova
 * empresa. Tudo e criado dentro de UM companyId — nao ha dado global.
 *
 * O historico e gerado para tras a partir de "hoje", com clientes em estagios
 * diferentes de retencao de proposito: assim as telas de Retencao, Campanhas e
 * Relatorios ja nascem contando uma historia real de oportunidade.
 */

/** PRNG deterministico (mulberry32) para o demo ser estavel entre execucoes. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number, hour = 10, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Date(date.getTime() - days * DAY);
}

function daysAhead(days: number, hour = 10, minute = 0) {
  return daysAgo(-days, hour, minute);
}

/** Primeiro dia de um mes N meses atras. */
function monthStart(monthsAgo: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
}

/**
 * Uma data dentro do mes indicado, nunca no futuro.
 * Para o mes corrente sorteia entre o dia 1 e hoje — assim o painel mostra
 * faturamento do mes mesmo quando o seed roda no primeiro dia do mes.
 */
function dateInMonth(monthsAgo: number, random: () => number) {
  const now = new Date();
  const start = monthStart(monthsAgo);
  const lastDay =
    monthsAgo === 0
      ? now.getDate()
      : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const day = 1 + Math.floor(random() * lastDay);
  const date = new Date(start.getFullYear(), start.getMonth(), Math.min(day, lastDay));
  date.setHours(9 + Math.floor(random() * 8), 0, 0, 0);
  return date > now ? now : date;
}

/* -------------------------------------------------------------------------- */
/* Catalogo de servicos                                                        */
/* -------------------------------------------------------------------------- */

const SERVICES = [
  {
    key: "lavagem-detalhada",
    name: "Lavagem Detalhada",
    description: "Lavagem externa e interna com produtos neutros e secagem técnica.",
    category: "lavagem",
    basePrice: 12000,
    durationMin: 90,
    recurrenceDays: 30,
  },
  {
    key: "lavagem-premium",
    name: "Lavagem Premium + Cera",
    description: "Lavagem detalhada com aplicação de cera de carnaúba e brilho em plásticos.",
    category: "lavagem",
    basePrice: 19000,
    durationMin: 120,
    recurrenceDays: 45,
  },
  {
    key: "polimento-comercial",
    name: "Polimento Comercial",
    description: "Refino de pintura em etapa única para remoção de micro riscos.",
    category: "polimento",
    basePrice: 45000,
    durationMin: 240,
    recurrenceDays: 180,
  },
  {
    key: "polimento-tecnico",
    name: "Polimento Técnico 3 Etapas",
    description: "Correção profunda de pintura com desempeno, refino e lustro.",
    category: "polimento",
    basePrice: 89000,
    durationMin: 480,
    recurrenceDays: 365,
  },
  {
    key: "vitrificacao",
    name: "Vitrificação de Pintura",
    description: "Proteção cerâmica com durabilidade de até 24 meses e brilho profundo.",
    category: "protecao",
    basePrice: 149000,
    durationMin: 600,
    recurrenceDays: 365,
  },
  {
    key: "cristalizacao-vidros",
    name: "Cristalização de Vidros",
    description: "Repelência à água nos vidros, mais segurança na chuva.",
    category: "protecao",
    basePrice: 18000,
    durationMin: 60,
    recurrenceDays: 180,
  },
  {
    key: "higienizacao-interna",
    name: "Higienização Interna Completa",
    description: "Extração de bancos, carpetes e teto com eliminação de odores.",
    category: "higienizacao",
    basePrice: 38000,
    durationMin: 300,
    recurrenceDays: 180,
  },
  {
    key: "hidratacao-couro",
    name: "Hidratação de Couro",
    description: "Limpeza e nutrição dos bancos de couro com proteção UV.",
    category: "higienizacao",
    basePrice: 26000,
    durationMin: 150,
    recurrenceDays: 120,
  },
  {
    key: "restauracao-farois",
    name: "Restauração de Faróis",
    description: "Remoção do amarelado e aplicação de verniz protetor.",
    category: "estetica",
    basePrice: 22000,
    durationMin: 120,
    recurrenceDays: 365,
  },
  {
    key: "motor-detalhado",
    name: "Limpeza de Motor",
    description: "Limpeza técnica do cofre do motor com proteção de plásticos.",
    category: "estetica",
    basePrice: 15000,
    durationMin: 90,
    recurrenceDays: 180,
  },
];

/* -------------------------------------------------------------------------- */
/* Clientes e veiculos                                                         */
/* -------------------------------------------------------------------------- */

type DemoCustomer = {
  name: string;
  phone: string;
  email: string;
  origin: string;
  birthDate: Date;
  notes?: string;
  vehicles: {
    brand: string;
    model: string;
    year: number;
    plate: string;
    color: string;
    size: string;
  }[];
  /** Historico: dias atras em que cada atendimento foi concluido. */
  history: { daysAgo: number; services: string[] }[];
};

const CUSTOMERS: DemoCustomer[] = [
  {
    name: "João Silva",
    phone: "11987650001",
    email: "joao.silva@email.com",
    origin: "indicacao",
    birthDate: new Date(1988, 2, 14),
    notes: "Cliente fiel. Prefere agendar aos sábados de manhã.",
    vehicles: [
      { brand: "Honda", model: "Civic", year: 2022, plate: "RGH4A21", color: "Prata", size: "medio" },
    ],
    history: [
      { daysAgo: 210, services: ["lavagem-premium", "cristalizacao-vidros"] },
      { daysAgo: 150, services: ["lavagem-detalhada"] },
      { daysAgo: 96, services: ["polimento-comercial", "lavagem-detalhada"] },
      { daysAgo: 22, services: ["lavagem-premium"] },
    ],
  },
  {
    name: "Carlos Oliveira",
    phone: "11987650002",
    email: "carlos.oliveira@email.com",
    origin: "instagram",
    birthDate: new Date(1979, 8, 3),
    notes: "Exigente com acabamento. Sempre fecha serviço completo.",
    vehicles: [
      { brand: "BMW", model: "320i", year: 2023, plate: "FKT9C08", color: "Preto", size: "medio" },
    ],
    history: [
      { daysAgo: 320, services: ["polimento-tecnico"] },
      { daysAgo: 250, services: ["vitrificacao"] },
      { daysAgo: 138, services: ["lavagem-premium", "hidratacao-couro"] },
    ],
  },
  {
    name: "Marcos Santos",
    phone: "11987650003",
    email: "marcos.santos@email.com",
    origin: "google",
    birthDate: new Date(1992, 11, 27),
    notes: "Usa o carro para aplicativo. Busca custo-benefício.",
    vehicles: [
      { brand: "Volkswagen", model: "Jetta", year: 2019, plate: "QWP2D77", color: "Branco", size: "medio" },
    ],
    history: [
      { daysAgo: 265, services: ["higienizacao-interna"] },
      { daysAgo: 198, services: ["lavagem-detalhada"] },
    ],
  },
  {
    name: "Ricardo Alves",
    phone: "11987650004",
    email: "ricardo.alves@email.com",
    origin: "indicacao",
    birthDate: new Date(1985, 5, 9),
    notes: "Trouxe dois amigos por indicação.",
    vehicles: [
      { brand: "Toyota", model: "Corolla", year: 2021, plate: "BNM7X33", color: "Cinza", size: "medio" },
    ],
    history: [
      { daysAgo: 175, services: ["lavagem-premium"] },
      { daysAgo: 118, services: ["restauracao-farois", "lavagem-detalhada"] },
    ],
  },
  {
    name: "Fernanda Lima",
    phone: "11987650005",
    email: "fernanda.lima@email.com",
    origin: "instagram",
    birthDate: new Date(1994, 0, 21),
    vehicles: [
      { brand: "Jeep", model: "Compass", year: 2023, plate: "LKS5V12", color: "Vermelho", size: "suv" },
    ],
    history: [
      { daysAgo: 140, services: ["vitrificacao", "cristalizacao-vidros"] },
      { daysAgo: 40, services: ["lavagem-premium"] },
    ],
  },
  {
    name: "Patrícia Nunes",
    phone: "11987650006",
    email: "patricia.nunes@email.com",
    origin: "google",
    birthDate: new Date(1990, 3, 5),
    vehicles: [
      { brand: "Hyundai", model: "HB20", year: 2020, plate: "TRE8J45", color: "Azul", size: "pequeno" },
    ],
    history: [
      { daysAgo: 232, services: ["lavagem-detalhada"] },
      { daysAgo: 12, services: ["higienizacao-interna", "lavagem-detalhada"] },
    ],
  },
  {
    name: "Eduardo Moreira",
    phone: "11987650007",
    email: "eduardo.moreira@email.com",
    origin: "passagem",
    birthDate: new Date(1976, 9, 30),
    notes: "Frota pequena: dois carros na família.",
    vehicles: [
      { brand: "Audi", model: "A4", year: 2022, plate: "PLM3H66", color: "Branco", size: "medio" },
      { brand: "Chevrolet", model: "Onix", year: 2018, plate: "GHT1B90", color: "Prata", size: "pequeno" },
    ],
    history: [
      { daysAgo: 300, services: ["polimento-comercial"] },
      { daysAgo: 205, services: ["lavagem-premium", "motor-detalhado"] },
    ],
  },
  {
    name: "Bruno Carvalho",
    phone: "11987650008",
    email: "bruno.carvalho@email.com",
    origin: "indicacao",
    birthDate: new Date(1997, 6, 16),
    vehicles: [
      { brand: "Fiat", model: "Argo", year: 2021, plate: "ZXC6N24", color: "Cinza", size: "pequeno" },
    ],
    history: [{ daysAgo: 58, services: ["lavagem-detalhada"] }],
  },
  {
    name: "Luciana Prado",
    phone: "11987650009",
    email: "luciana.prado@email.com",
    origin: "instagram",
    birthDate: new Date(1986, 1, 8),
    vehicles: [
      { brand: "Volvo", model: "XC60", year: 2024, plate: "VBN9K51", color: "Preto", size: "suv" },
    ],
    history: [
      { daysAgo: 88, services: ["vitrificacao"] },
      { daysAgo: 30, services: ["lavagem-premium", "hidratacao-couro"] },
    ],
  },
  {
    name: "André Ferreira",
    phone: "11987650010",
    email: "andre.ferreira@email.com",
    origin: "google",
    birthDate: new Date(1983, 10, 2),
    vehicles: [
      { brand: "Toyota", model: "Hilux", year: 2020, plate: "MNB4R87", color: "Prata", size: "grande" },
    ],
    history: [
      { daysAgo: 340, services: ["higienizacao-interna"] },
      { daysAgo: 268, services: ["lavagem-detalhada", "motor-detalhado"] },
    ],
  },
  {
    name: "Rafael Castro",
    phone: "11987650011",
    email: "rafael.castro@email.com",
    origin: "indicacao",
    birthDate: new Date(1991, 7, 19),
    vehicles: [
      { brand: "Honda", model: "HR-V", year: 2022, plate: "DFG2S73", color: "Branco", size: "suv" },
    ],
    history: [{ daysAgo: 6, services: ["lavagem-premium"] }],
  },
  {
    name: "Juliana Rocha",
    phone: "11987650012",
    email: "juliana.rocha@email.com",
    origin: "outro",
    birthDate: new Date(1999, 4, 11),
    notes: "Primeiro contato pelo WhatsApp, ainda sem serviço realizado.",
    vehicles: [
      { brand: "Renault", model: "Kwid", year: 2023, plate: "HJK7Y40", color: "Vermelho", size: "pequeno" },
    ],
    history: [],
  },
];

/* -------------------------------------------------------------------------- */
/* Agenda futura                                                               */
/* -------------------------------------------------------------------------- */

const UPCOMING: {
  customer: string;
  services: string[];
  inDays: number;
  hour: number;
  status: string;
}[] = [
  { customer: "Rafael Castro", services: ["polimento-comercial"], inDays: 0, hour: 9, status: "em_andamento" },
  { customer: "Patrícia Nunes", services: ["lavagem-premium"], inDays: 0, hour: 14, status: "confirmado" },
  { customer: "João Silva", services: ["lavagem-detalhada", "cristalizacao-vidros"], inDays: 1, hour: 8, status: "confirmado" },
  { customer: "Luciana Prado", services: ["hidratacao-couro"], inDays: 1, hour: 13, status: "agendado" },
  { customer: "Fernanda Lima", services: ["lavagem-premium"], inDays: 2, hour: 10, status: "agendado" },
  { customer: "Bruno Carvalho", services: ["higienizacao-interna"], inDays: 3, hour: 9, status: "agendado" },
  { customer: "Carlos Oliveira", services: ["polimento-tecnico"], inDays: 4, hour: 8, status: "agendado" },
  { customer: "Eduardo Moreira", services: ["lavagem-detalhada"], inDays: 5, hour: 15, status: "agendado" },
];

/* -------------------------------------------------------------------------- */
/* Geracao                                                                     */
/* -------------------------------------------------------------------------- */

export async function seedDemoDataForCompany(companyId: string) {
  const random = rng(20240917);

  // 1. Catalogo de servicos
  const serviceByKey = new Map<string, { id: string; name: string; basePrice: number; durationMin: number }>();
  for (const service of SERVICES) {
    const created = await db.serviceItem.create({
      data: {
        companyId,
        name: service.name,
        description: service.description,
        category: service.category,
        basePrice: service.basePrice,
        durationMin: service.durationMin,
        recurrenceDays: service.recurrenceDays,
      },
    });
    serviceByKey.set(service.key, created);
  }

  const service = (key: string) => {
    const found = serviceByKey.get(key);
    if (!found) throw new Error(`Serviço de demonstração desconhecido: ${key}`);
    return found;
  };

  // 2. Clientes, veiculos e historico de ordens de servico
  const customerByName = new Map<string, { id: string; vehicleId: string | null }>();
  let orderNumber = 0;

  for (const demo of CUSTOMERS) {
    // O cliente entrou na base pouco antes do primeiro atendimento. Sem isso,
    // todos apareceriam como "novos deste mes" no painel.
    const firstVisitDaysAgo = demo.history.length
      ? Math.max(...demo.history.map((visit) => visit.daysAgo))
      : Math.floor(30 + random() * 150);
    const createdAt = daysAgo(firstVisitDaysAgo + 3 + Math.floor(random() * 20), 10);

    const customer = await db.customer.create({
      data: {
        companyId,
        createdAt,
        name: demo.name,
        phone: demo.phone,
        email: demo.email,
        origin: demo.origin,
        birthDate: demo.birthDate,
        notes: demo.notes,
        vehicles: {
          create: demo.vehicles.map((vehicle) => ({
            companyId,
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            plate: vehicle.plate,
            color: vehicle.color,
            size: vehicle.size,
          })),
        },
      },
      include: { vehicles: true },
    });

    const primaryVehicle = customer.vehicles[0] ?? null;
    customerByName.set(demo.name, { id: customer.id, vehicleId: primaryVehicle?.id ?? null });

    for (const visit of demo.history) {
      const items = visit.services.map((key) => {
        const item = service(key);
        // Pequena variacao de preco praticado (desconto/porte do veiculo).
        const factor = 0.95 + random() * 0.12;
        return {
          serviceItemId: item.id,
          description: item.name,
          quantity: 1,
          unitPriceCents: Math.round((item.basePrice * factor) / 100) * 100,
        };
      });
      const total = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
      const finishedAt = daysAgo(visit.daysAgo, 9 + Math.floor(random() * 8));

      await db.workOrder.create({
        data: {
          companyId,
          number: ++orderNumber,
          customerId: customer.id,
          vehicleId: primaryVehicle?.id ?? null,
          status: "concluida",
          paymentMethod: ["pix", "credito", "debito", "dinheiro"][Math.floor(random() * 4)],
          totalCents: total,
          openedAt: new Date(finishedAt.getTime() - 3 * 60 * 60 * 1000),
          finishedAt,
          createdAt: new Date(finishedAt.getTime() - 3 * 60 * 60 * 1000),
          items: { create: items },
        },
      });
    }
  }

  // 2b. Movimento recorrente dos clientes fieis.
  //
  // O historico acima e ancorado em "dias atras", o que deixaria o mes corrente
  // sem faturamento sempre que o seed rodasse no inicio do mes. Aqui espalhamos
  // atendimentos pelos ultimos 8 meses CALENDARIO — inclusive o atual — para
  // que grafico de faturamento, ticket medio e comparativo mensal facam sentido
  // em qualquer data.
  //
  // So os clientes fieis entram: os que precisam aparecer como "em risco" ou
  // "inativo" na tela de Retencao ficam de fora de proposito.
  const REGULARS = [
    "João Silva",
    "Fernanda Lima",
    "Patrícia Nunes",
    "Luciana Prado",
    "Rafael Castro",
    "Bruno Carvalho",
  ];
  const REGULAR_SERVICES = [
    ["lavagem-detalhada"],
    ["lavagem-premium"],
    ["lavagem-premium", "cristalizacao-vidros"],
    ["lavagem-detalhada", "motor-detalhado"],
    ["hidratacao-couro"],
    ["higienizacao-interna"],
    ["restauracao-farois"],
  ];

  for (let monthsAgo = 7; monthsAgo >= 0; monthsAgo--) {
    // No mes corrente o volume acompanha os dias ja decorridos.
    const elapsed = monthsAgo === 0 ? new Date().getDate() : 30;
    const visits = Math.max(2, Math.round((elapsed / 30) * (4 + random() * 3)));

    for (let index = 0; index < visits; index++) {
      const name = REGULARS[Math.floor(random() * REGULARS.length)];
      const target = customerByName.get(name);
      if (!target) continue;

      const chosen = REGULAR_SERVICES[Math.floor(random() * REGULAR_SERVICES.length)];
      const items = chosen.map((key) => {
        const item = service(key);
        const factor = 0.95 + random() * 0.12;
        return {
          serviceItemId: item.id,
          description: item.name,
          quantity: 1,
          unitPriceCents: Math.round((item.basePrice * factor) / 100) * 100,
        };
      });
      const total = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
      const finishedAt = dateInMonth(monthsAgo, random);

      await db.workOrder.create({
        data: {
          companyId,
          number: ++orderNumber,
          customerId: target.id,
          vehicleId: target.vehicleId,
          status: "concluida",
          paymentMethod: ["pix", "credito", "debito", "dinheiro"][Math.floor(random() * 4)],
          totalCents: total,
          openedAt: new Date(finishedAt.getTime() - 3 * 60 * 60 * 1000),
          finishedAt,
          createdAt: new Date(finishedAt.getTime() - 3 * 60 * 60 * 1000),
          items: { create: items },
        },
      });
    }
  }

  // 3. Agenda: proximos atendimentos
  for (const slot of UPCOMING) {
    const target = customerByName.get(slot.customer);
    if (!target) continue;

    const services = slot.services.map(service);
    const duration = services.reduce((sum, item) => sum + item.durationMin, 0);
    const startsAt = daysAhead(slot.inDays, slot.hour);

    await db.appointment.create({
      data: {
        companyId,
        customerId: target.id,
        vehicleId: target.vehicleId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + duration * 60 * 1000),
        status: slot.status,
        services: { create: services.map((item) => ({ serviceItemId: item.id })) },
      },
    });
  }

  // Alguns atendimentos ja concluidos na agenda da semana passada,
  // para a Agenda nao parecer vazia ao olhar para tras.
  const pastSlots = [
    { customer: "João Silva", services: ["lavagem-premium"], daysAgo: 22, hour: 9 },
    { customer: "Luciana Prado", services: ["lavagem-premium", "hidratacao-couro"], daysAgo: 30, hour: 11 },
    { customer: "Patrícia Nunes", services: ["higienizacao-interna"], daysAgo: 12, hour: 8 },
    { customer: "Rafael Castro", services: ["lavagem-premium"], daysAgo: 6, hour: 16 },
  ];
  for (const slot of pastSlots) {
    const target = customerByName.get(slot.customer);
    if (!target) continue;
    const services = slot.services.map(service);
    const duration = services.reduce((sum, item) => sum + item.durationMin, 0);
    const startsAt = daysAgo(slot.daysAgo, slot.hour);
    await db.appointment.create({
      data: {
        companyId,
        customerId: target.id,
        vehicleId: target.vehicleId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + duration * 60 * 1000),
        status: "concluido",
        services: { create: services.map((item) => ({ serviceItemId: item.id })) },
      },
    });
  }

  // 4. Orcamentos em estagios diferentes do funil
  const quotes: {
    customer: string;
    services: string[];
    status: string;
    createdDaysAgo: number;
    validInDays: number;
    discount?: number;
  }[] = [
    { customer: "Carlos Oliveira", services: ["polimento-tecnico", "vitrificacao"], status: "enviado", createdDaysAgo: 3, validInDays: 12 },
    { customer: "Marcos Santos", services: ["higienizacao-interna", "lavagem-detalhada"], status: "enviado", createdDaysAgo: 6, validInDays: 9, discount: 5000 },
    { customer: "Ricardo Alves", services: ["vitrificacao"], status: "aprovado", createdDaysAgo: 9, validInDays: 6 },
    { customer: "André Ferreira", services: ["polimento-comercial", "motor-detalhado"], status: "rascunho", createdDaysAgo: 1, validInDays: 14 },
    { customer: "Eduardo Moreira", services: ["lavagem-premium", "cristalizacao-vidros"], status: "recusado", createdDaysAgo: 25, validInDays: -10 },
    { customer: "Juliana Rocha", services: ["lavagem-detalhada"], status: "enviado", createdDaysAgo: 2, validInDays: 13 },
    { customer: "Fernanda Lima", services: ["restauracao-farois"], status: "expirado", createdDaysAgo: 45, validInDays: -30 },
  ];

  let quoteNumber = 0;
  for (const quote of quotes) {
    const target = customerByName.get(quote.customer);
    if (!target) continue;

    const items = quote.services.map((key) => {
      const item = service(key);
      return {
        serviceItemId: item.id,
        description: item.name,
        quantity: 1,
        unitPriceCents: item.basePrice,
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    const createdAt = daysAgo(quote.createdDaysAgo, 11);

    await db.quote.create({
      data: {
        companyId,
        number: ++quoteNumber,
        customerId: target.id,
        vehicleId: target.vehicleId,
        status: quote.status,
        validUntil: daysAhead(quote.validInDays, 23, 59),
        discountCents: quote.discount ?? 0,
        totalCents: subtotal - (quote.discount ?? 0),
        createdAt,
        items: { create: items },
      },
    });
  }

  // 5. Ordens de servico abertas agora (fila do dia)
  const openOrders: { customer: string; services: string[]; status: string }[] = [
    { customer: "Rafael Castro", services: ["polimento-comercial"], status: "em_andamento" },
    { customer: "Patrícia Nunes", services: ["lavagem-premium"], status: "aberta" },
    { customer: "Ricardo Alves", services: ["vitrificacao"], status: "aguardando_retirada" },
  ];
  for (const order of openOrders) {
    const target = customerByName.get(order.customer);
    if (!target) continue;
    const items = order.services.map((key) => {
      const item = service(key);
      return {
        serviceItemId: item.id,
        description: item.name,
        quantity: 1,
        unitPriceCents: item.basePrice,
      };
    });
    await db.workOrder.create({
      data: {
        companyId,
        number: ++orderNumber,
        customerId: target.id,
        vehicleId: target.vehicleId,
        status: order.status,
        totalCents: items.reduce((sum, item) => sum + item.unitPriceCents, 0),
        openedAt: daysAgo(0, 8),
        items: { create: items },
      },
    });
  }

  // 6. Campanhas de retencao
  //
  // As campanhas do demo nascem como rascunho, SEM participantes e sem
  // contadores preenchidos. Antes elas vinham com numeros escritos a mao
  // (24 enviadas, 7 conversoes, R$ 1.480 de receita) que nao correspondiam a
  // nada no banco. Agora todo numero de Campanhas e calculado a partir de
  // `CampaignParticipant`, entao inventar participantes aqui seria inventar
  // metrica de novo — a campanha ganha participantes quando alguem a cria de
  // verdade pela tela.
  await db.campaign.createMany({
    data: [
      {
        companyId,
        name: "Volta pra casa — clientes em risco",
        channel: "whatsapp",
        audience: "em_risco",
        status: "rascunho",
        message:
          "Oi {nome}! Faz um tempo que o {veiculo} não passa aqui. Preparei 15% de desconto na sua próxima lavagem detalhada. Posso reservar um horário?",
      },
      {
        companyId,
        name: "Reativação 6 meses",
        channel: "whatsapp",
        audience: "inativos",
        status: "rascunho",
        message:
          "{nome}, sentimos sua falta! Que tal deixar o {veiculo} novo de novo? Higienização completa com condição especial esta semana.",
      },
      {
        companyId,
        name: "Lembrete de vitrificação (12 meses)",
        channel: "whatsapp",
        audience: "atencao",
        status: "agendada",
        message:
          "Oi {nome}! A proteção do seu {veiculo} está chegando ao fim do ciclo. Quer agendar a revitalização?",
        scheduledAt: daysAhead(3, 9),
      },
      {
        companyId,
        name: "Aniversariantes do mês",
        channel: "whatsapp",
        audience: "aniversariantes",
        status: "rascunho",
        message:
          "Parabéns, {nome}! No mês do seu aniversário a lavagem premium sai com 20% de desconto. 🎉",
      },
      {
        companyId,
        name: "Clube VIP — proposta de recorrência",
        channel: "email",
        audience: "vip",
        status: "rascunho",
        message:
          "{nome}, montamos um plano mensal para manter o {veiculo} sempre impecável, com prioridade na agenda.",
      },
    ],
  });
}
