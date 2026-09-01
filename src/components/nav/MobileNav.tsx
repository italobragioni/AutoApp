"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutGrid, X } from "lucide-react";

import { NAV_GROUPS, NAV_ITEMS, itemsOfGroup } from "@/lib/navigation";
import { cn } from "@/lib/format";

/**
 * Mobile: barra inferior com os 4 destinos mais usados + "Mais",
 * que abre a lista completa em uma folha deslizante.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = NAV_ITEMS.filter((item) => item.mobile);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="animate-fade-up absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-line bg-ink-900 px-4 pb-8 pt-3">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-600" />
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-sm font-semibold text-white">Menu</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="focus-ring rounded-lg p-1.5 text-muted hover:text-white"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              {NAV_GROUPS.map((group) => (
                <div key={group.key}>
                  <p className="pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted/70">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {itemsOfGroup(group.key).map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "focus-ring flex items-center gap-2.5 rounded-xl border px-3 py-3 text-sm transition-colors",
                            isActive(item.href)
                              ? "border-volt-400/30 bg-volt-400/10 font-semibold text-white"
                              : "border-line bg-ink-850 text-soft",
                          )}
                        >
                          <Icon
                            size={17}
                            className={`shrink-0 ${isActive(item.href) ? "text-volt-400" : "text-muted"}`}
                          />
                          <span className="leading-tight">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink-900/95 backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring flex flex-col items-center gap-1 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 text-[0.65rem] font-medium transition-colors",
                    active ? "text-volt-400" : "text-muted",
                  )}
                >
                  <Icon size={19} />
                  {item.short}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn(
                "focus-ring flex w-full flex-col items-center gap-1 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 text-[0.65rem] font-medium transition-colors",
                open ? "text-volt-400" : "text-muted",
              )}
            >
              <LayoutGrid size={19} />
              Mais
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
