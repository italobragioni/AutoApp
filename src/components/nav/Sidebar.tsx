"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/Logo";
import { NAV_GROUPS, itemsOfGroup } from "@/lib/navigation";
import { cn } from "@/lib/format";

export function Sidebar({
  retentionBadge,
  allowed,
}: {
  /** Nº de clientes precisando de contato — o produto sinaliza a oportunidade. */
  retentionBadge?: number;
  /** Hrefs que o papel atual pode ver. Resolvido no servidor. */
  allowed: string[];
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-ink-900 lg:flex">
      <div className="flex h-16 items-center border-b border-line px-5">
        <Link href="/dashboard" className="focus-ring rounded-lg">
          <Logo size={32} />
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.key}>
            <p className="px-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted/70">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {itemsOfGroup(group.key, allowed).map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                const showBadge = item.href === "/retencao" && !!retentionBadge;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "focus-ring group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-volt-400/10 font-semibold text-white"
                          : "text-soft hover:bg-ink-800 hover:text-white",
                      )}
                    >
                      {active && (
                        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-volt-400" />
                      )}
                      <Icon
                        size={17}
                        className={cn(
                          "shrink-0 transition-colors",
                          active ? "text-volt-400" : "text-muted group-hover:text-soft",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                      {showBadge && (
                        <span className="ml-auto rounded-full bg-volt-400 px-1.5 py-0.5 text-[0.65rem] font-bold text-ink-950">
                          {retentionBadge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
