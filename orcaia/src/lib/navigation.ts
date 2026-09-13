// Itens do menu principal da area logada. O menu e sensivel ao nicho: a
// vidracaria tem um modulo proprio (Orcamentos + Vidros); os demais nichos
// mantem o menu generico inalterado.
// Os icones sao nomes do lucide-react, resolvidos no componente.

export type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const DASHBOARD: NavItem = { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" };
const CLIENTES: NavItem = { href: "/clientes", label: "Clientes", icon: "Users" };
const PRODUTOS: NavItem = { href: "/produtos", label: "Produtos e servicos", icon: "Package" };
const MATERIAIS: NavItem = { href: "/materiais", label: "Materiais", icon: "Boxes" };
const CUSTOS: NavItem = { href: "/custos", label: "Custos", icon: "Wallet" };
const ORCAMENTOS: NavItem = { href: "/orcamentos", label: "Orcamentos", icon: "FileText" };
const VIDROS: NavItem = { href: "/vidros", label: "Vidros", icon: "Layers" };
const CONFIG: NavItem = { href: "/configuracoes", label: "Configuracoes", icon: "Settings" };

// Menu generico (serralheria, marcenaria) — inalterado.
const GENERIC_NAV: NavItem[] = [DASHBOARD, CLIENTES, PRODUTOS, MATERIAIS, CUSTOS, CONFIG];

// Menu da vidracaria — com o modulo especifico.
const VIDRACARIA_NAV: NavItem[] = [DASHBOARD, CLIENTES, ORCAMENTOS, VIDROS, CONFIG];

export function navForNiche(niche: string): NavItem[] {
  return niche === "vidracaria" ? VIDRACARIA_NAV : GENERIC_NAV;
}
