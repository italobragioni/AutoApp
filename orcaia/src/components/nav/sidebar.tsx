"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  Wallet,
  FileText,
  Layers,
  Hammer,
  Settings,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/navigation";
import { logoutAction } from "@/app/actions/auth";
import { switchCompanyAction } from "@/app/actions/company";
import { cn } from "@/lib/core/cn";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  Wallet,
  FileText,
  Layers,
  Hammer,
  Settings,
};

type Props = {
  companyName: string;
  nicheLabel: string;
  memberships: { companyId: string; companyName: string }[];
  activeCompanyId: string;
  items: NavItem[];
};

export function Sidebar(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Barra superior (mobile) */}
      <div className="flex items-center justify-between border-b border-surface-border bg-white px-4 py-3 md:hidden print:hidden">
        <span className="text-lg font-bold text-brand">ORCAIA</span>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="rounded-lg p-2 text-ink-soft hover:bg-surface-soft"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Overlay (mobile) */}
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {/* Sidebar: fixa no desktop, drawer no mobile */}
      <aside
        className={cn(
          "flex w-60 flex-col border-r border-surface-border bg-white print:hidden",
          "fixed inset-y-0 left-0 z-40 transition-transform md:static md:z-auto md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between p-5">
          <span className="text-lg font-bold text-brand">ORCAIA</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="rounded-lg p-1 text-ink-soft hover:bg-surface-soft md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <NavBody {...props} onNavigate={() => setOpen(false)} />
      </aside>
    </>
  );
}

function NavBody({
  companyName,
  nicheLabel,
  memberships,
  activeCompanyId,
  items,
  onNavigate,
}: Props & { onNavigate: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div className="px-4">
        {memberships.length > 1 ? (
          <form action={switchCompanyAction}>
            <select
              name="companyId"
              defaultValue={activeCompanyId}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="w-full rounded-lg border border-surface-border bg-surface-soft px-3 py-2 text-sm font-medium text-ink"
            >
              {memberships.map((m) => (
                <option key={m.companyId} value={m.companyId}>
                  {m.companyName}
                </option>
              ))}
            </select>
          </form>
        ) : (
          <div className="rounded-lg bg-surface-soft px-3 py-2">
            <p className="truncate text-sm font-medium text-ink">{companyName}</p>
          </div>
        )}
        <p className="mt-1 px-1 text-xs text-ink-faint">{nicheLabel}</p>
      </div>

      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-brand-muted text-brand" : "text-ink-soft hover:bg-surface-soft",
              )}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <form action={logoutAction} className="p-3">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-soft">
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </form>
    </>
  );
}
