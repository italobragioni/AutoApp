"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, LogOut, Plus, Settings } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui";
import { logoutAction, switchCompanyAction } from "@/app/actions/auth";
import type { CurrentContext } from "@/lib/tenant";
import { cn } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";

const PLAN_LABEL: Record<string, string> = {
  trial: "Teste",
  starter: "Starter",
  pro: "Pro",
};

export function Topbar({ context }: { context: CurrentContext }) {
  const [openMenu, setOpenMenu] = useState<"company" | "user" | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink-950/85 backdrop-blur">
      <div ref={wrapper} className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Marca no mobile (no desktop ela vive na sidebar) */}
        <Link href="/dashboard" className="focus-ring rounded-lg lg:hidden">
          <Logo size={30} compact />
        </Link>

        {/* Seletor de empresa — a base do multi-tenant */}
        <div className="relative min-w-0 flex-1 lg:flex-none">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === "company" ? null : "company")}
            aria-expanded={openMenu === "company"}
            aria-haspopup="menu"
            className="focus-ring flex w-full max-w-xs items-center gap-2.5 rounded-xl border border-line bg-ink-900 px-3 py-2 text-left transition-colors hover:border-ink-600"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-volt-400/12 text-volt-300">
              <Building2 size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">
                {context.company.name}
              </span>
              <span className="block text-[0.65rem] uppercase tracking-wide text-muted">
                Plano {PLAN_LABEL[context.company.plan] ?? context.company.plan}
              </span>
            </span>
            <ChevronDown size={15} className="shrink-0 text-muted" />
          </button>

          {openMenu === "company" && (
            <div
              role="menu"
              className="animate-fade absolute left-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-line bg-ink-900 shadow-lift"
            >
              <p className="px-4 pb-1.5 pt-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted">
                Suas empresas
              </p>
              <ul className="pb-1">
                {context.companies.map((company) => {
                  const active = company.id === context.company.id;
                  return (
                    <li key={company.id}>
                      <form action={switchCompanyAction}>
                        <input type="hidden" name="companyId" value={company.id} />
                        <button
                          type="submit"
                          className={cn(
                            "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-ink-800",
                            active ? "text-white" : "text-soft",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{company.name}</span>
                            <span className="block text-[0.65rem] text-muted">
                              {ROLE_LABEL[company.role] ?? company.role}
                            </span>
                          </span>
                          {active && <Check size={15} className="shrink-0 text-volt-400" />}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-line">
                <Link
                  href="/configuracoes"
                  onClick={() => setOpenMenu(null)}
                  className="flex items-center gap-2 px-4 py-3 text-sm text-soft transition-colors hover:bg-ink-800 hover:text-white"
                >
                  <Plus size={15} className="text-muted" />
                  Gerenciar empresas
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Menu do usuario */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === "user" ? null : "user")}
            aria-expanded={openMenu === "user"}
            aria-haspopup="menu"
            className="focus-ring flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors hover:bg-ink-900"
          >
            <Avatar name={context.user.name} color={context.user.avatarColor} size={34} />
            <span className="hidden text-left sm:block">
              <span className="block max-w-[10rem] truncate text-sm font-medium text-white">
                {context.user.name}
              </span>
              <span className="block text-[0.65rem] text-muted">
                {ROLE_LABEL[context.role] ?? context.role}
              </span>
            </span>
            <ChevronDown size={15} className="hidden text-muted sm:block" />
          </button>

          {openMenu === "user" && (
            <div
              role="menu"
              className="animate-fade absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-ink-900 shadow-lift"
            >
              <div className="border-b border-line px-4 py-3">
                <p className="truncate text-sm font-medium text-white">{context.user.name}</p>
                <p className="truncate text-xs text-muted">{context.user.email}</p>
              </div>
              <Link
                href="/configuracoes"
                onClick={() => setOpenMenu(null)}
                className="flex items-center gap-2.5 px-4 py-3 text-sm text-soft transition-colors hover:bg-ink-800 hover:text-white"
              >
                <Settings size={15} className="text-muted" />
                Configurações
              </Link>
              <form action={logoutAction} className="border-t border-line">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-soft transition-colors hover:bg-ink-800 hover:text-rose-300"
                >
                  <LogOut size={15} className="text-muted" />
                  Sair
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
