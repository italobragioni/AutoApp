import type { Permission } from "@/lib/permissions";
import {
  BarChart3,
  CalendarDays,
  Car,
  FileText,
  LayoutDashboard,
  Megaphone,
  Repeat2,
  Settings,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** Rotulo curto usado no menu inferior do mobile. */
  short: string;
  icon: LucideIcon;
  group: "operacao" | "crescimento" | "sistema";
  /** Aparece no menu inferior do mobile (max. 4 + "Mais"). */
  mobile?: boolean;
  /**
   * Permissao necessaria para o item aparecer. O menu esconder nao e a trava:
   * a pagina correspondente tambem exige a mesma permissao no servidor.
   */
  requires?: Permission;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "Início", icon: LayoutDashboard, group: "operacao", mobile: true },
  { href: "/agenda", label: "Agenda", short: "Agenda", icon: CalendarDays, group: "operacao", mobile: true },
  { href: "/clientes", label: "Clientes", short: "Clientes", icon: Users, group: "operacao", mobile: true },
  { href: "/veiculos", label: "Veículos", short: "Veículos", icon: Car, group: "operacao" },
  { href: "/servicos", label: "Serviços", short: "Serviços", icon: Sparkles, group: "operacao" },
  { href: "/orcamentos", label: "Orçamentos", short: "Orçam.", icon: FileText, group: "operacao", requires: "quotes.write" },
  { href: "/ordens", label: "Ordens de Serviço", short: "OS", icon: Wrench, group: "operacao" },
  { href: "/retencao", label: "Retenção", short: "Retenção", icon: Repeat2, group: "crescimento", mobile: true },
  { href: "/campanhas", label: "Campanhas", short: "Campanhas", icon: Megaphone, group: "crescimento", requires: "campaigns.write" },
  { href: "/relatorios", label: "Relatórios", short: "Relatórios", icon: BarChart3, group: "crescimento", requires: "reports.finance" },
  { href: "/configuracoes", label: "Configurações", short: "Config.", icon: Settings, group: "sistema" },
];

export const NAV_GROUPS: { key: NavItem["group"]; label: string }[] = [
  { key: "operacao", label: "Operação" },
  { key: "crescimento", label: "Crescimento" },
  { key: "sistema", label: "Sistema" },
];

export function itemsOfGroup(group: NavItem["group"], allowed?: string[]) {
  return NAV_ITEMS.filter(
    (item) => item.group === group && (!allowed || allowed.includes(item.href)),
  );
}

/** Itens que o papel pode ver, resolvido no servidor e repassado ao menu. */
export function allowedHrefs(can: (permission: Permission) => boolean) {
  return NAV_ITEMS.filter((item) => !item.requires || can(item.requires)).map(
    (item) => item.href,
  );
}
