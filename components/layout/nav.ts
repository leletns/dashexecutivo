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

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: { href: string; label: string }[];
};

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/administrativo", label: "Administrativo", icon: Building2 },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/juridico", label: "Jurídico", icon: Scale },
  { href: "/contabil", label: "Contábil", icon: CalculatorIcon },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  {
    href: "/eventos",
    label: "Produção de eventos",
    icon: CalendarRange,
    children: [
      { href: "/eventos/edicao-1", label: "1ª edição anual" },
      { href: "/eventos/edicao-2", label: "2ª edição anual" },
      { href: "/eventos/edicao-3", label: "3ª edição anual" },
      { href: "/eventos/edicao-4", label: "4ª edição anual" },
    ],
  },
];
