"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/format";

/**
 * FAQ da landing (acordeão). Respostas honestas — sem prometer o que não existe
 * (nada de teste grátis, nada de garantia de reembolso).
 */

const FAQ: { q: string; a: string }[] = [
  {
    q: "Tem teste grátis?",
    a: "Não. Preferimos manter o preço baixo — R$47 por mês — a oferecer um período de teste. Em vez de te dar alguns dias grátis, te damos um preço justo desde o primeiro dia. E como não há fidelidade, se não fizer sentido você cancela quando quiser.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Pode. Não há fidelidade nem multa. Você cancela quando quiser e continua com acesso até o fim do período que já pagou.",
  },
  {
    q: "Como funciona a cobrança?",
    a: "É uma assinatura mensal de R$47, no cartão, processada com segurança pela Cakto. A cobrança começa quando você cria a conta e se renova a cada mês, até você cancelar.",
  },
  {
    q: "Preciso instalar algo?",
    a: "Não. O AUTOVOLT funciona direto no navegador. Você cria a conta e já começa a usar, no computador ou no celular — não precisa baixar nada.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim, foi feito pensando no celular. Você acompanha a agenda, consulta clientes e dispara o contato pelo WhatsApp de qualquer lugar, direto do telefone.",
  },
  {
    q: "Consigo importar meus clientes de uma planilha?",
    a: "Por enquanto o cadastro é feito dentro do sistema, de forma rápida. Ainda não temos importação automática por planilha. Se a sua base é grande, fale com o suporte pelo WhatsApp que a gente te orienta sobre o melhor jeito de começar.",
  },
  {
    q: "Se eu cancelar, perco meus dados?",
    a: "Cancelar não apaga nada. Seus clientes, veículos e histórico continuam guardados; você só perde o acesso quando o período pago termina. Se voltar depois, está tudo lá.",
  },
  {
    q: "Serve pra quem trabalha sozinho?",
    a: "Serve — e é onde faz mais diferença. Quando é você que atende, lava e ainda tenta lembrar quem some, o sistema vira sua memória: ele aponta quem está na hora de voltar pra você não perder faturamento sem perceber.",
  },
  {
    q: "Preciso de CNPJ pra usar?",
    a: "Não. Você pode usar como pessoa física ou como empresa. O que importa é organizar seus atendimentos e trazer seus clientes de volta.",
  },
  {
    q: "Em quanto tempo começo a usar?",
    a: "Na hora. Você cria a conta, cadastra seus primeiros serviços e clientes e já começa a registrar os atendimentos no mesmo dia.",
  },
];

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-ring flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-white sm:text-base">{q}</span>
        <ChevronDown
          size={18}
          className={cn("shrink-0 text-volt-400 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <p className="pb-4 text-sm leading-relaxed text-muted">{a}</p>}
    </div>
  );
}

export function Faq() {
  return (
    <div className="mx-auto max-w-3xl">
      {FAQ.map((item) => (
        <Item key={item.q} q={item.q} a={item.a} />
      ))}
    </div>
  );
}
