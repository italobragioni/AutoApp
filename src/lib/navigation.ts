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
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "Início", icon: LayoutDashboard, group: "operacao", mobile: true },
  { href: "/agenda", label: "Agenda", short: "Agenda", icon: CalendarDays, group: "operacao", mobile: true },
  { href: "/clientes", label: "Clientes", short: "Clientes", icon: Users, group: "operacao", mobile: true },
  { href: "/veiculos", label: "Veículos", short: "Veículos", icon: Car, group: "operacao" },
  { href: "/servicos", label: "Serviços", short: "Serviços", icon: Sparkles, group: "operacao" },
  { href: "/orcamentos", label: "Orçamentos", short: "Orçam.", icon: FileText, group: "operacao" },
  { href: "/ordens", label: "Ordens de Serviço", short: "OS", icon: Wrench, group: "operacao" },
  { href: "/retencao", label: "Retenção", short: "Retenção", icon: Repeat2, group: "crescimento", mobile: true },
  { href: "/campanhas", label: "Campanhas", short: "Campanhas", icon: Megaphone, group: "crescimento" },
  { href: "/relatorios", label: "Relatórios", short: "Relatórios", icon: BarChart3, group: "crescimento" },
  { href: "/configuracoes", label: "Configurações", short: "Config.", icon: Settings, group: "sistema" },
];

export const NAV_GROUPS: { key: NavItem["group"]; label: string }[] = [
  { key: "operacao", label: "Operação" },
  { key: "crescimento", label: "Crescimento" },
  { key: "sistema", label: "Sistema" },
];

export function itemsOfGroup(group: NavItem["group"]) {
  return NAV_ITEMS.filter((item) => item.group === group);
}
