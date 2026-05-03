import {
  LayoutDashboard,
  Building2,
  Wallet,
  Scale,
  Calculator as CalculatorIcon,
  Megaphone,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";
import { useAppState } from "@/lib/app-state";

export type NavChild = { href: string; label: string };

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: NavChild[];
};

export const STATIC_NAV: NavItem[] = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/administrativo", label: "Administrativo", icon: Building2 },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/juridico", label: "Jurídico", icon: Scale },
  { href: "/contabil", label: "Contábil", icon: CalculatorIcon },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
];

export const EVENTOS_NAV: Omit<NavItem, "children"> = {
  href: "/eventos",
  label: "Produção de eventos",
  icon: CalendarRange,
};

export function useNav(): NavItem[] {
  const { state } = useAppState();
  const eventosChildren: NavChild[] = state.edicoes.map((e) => ({
    href: `/eventos/${e.slug}`,
    label: e.nome,
  }));
  return [
    ...STATIC_NAV,
    { ...EVENTOS_NAV, children: eventosChildren },
  ];
}
