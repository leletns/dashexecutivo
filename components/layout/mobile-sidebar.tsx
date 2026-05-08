"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Menu, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { useNav } from "@/components/layout/nav";
import { cn } from "@/lib/utils";

export function MobileSidebar() {
  const pathname = usePathname();
  const NAV = useNav();
  const [open, setOpen] = React.useState(false);
  const [openGroup, setOpenGroup] = React.useState<string | null>("/eventos");

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="glass"
          size="icon"
          className="md:hidden print:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[86vw] max-w-xs p-0 flex flex-col"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Logo size={32} withGlow />
              <div className="leading-tight">
                <SheetTitle className="text-sm">Dash executivo</SheetTitle>
                <div className="text-[10px] text-muted-foreground -mt-0.5">
                  Visão consolidada
                </div>
              </div>
            </div>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          <ul className="space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const hasChildren = !!item.children?.length;
              const isGroupOpen =
                openGroup === item.href || pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => hasChildren && setOpenGroup(item.href)}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      isActive
                        ? "bg-foreground/[0.06] dark:bg-white/[0.07] text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] dark:hover:bg-white/[0.04]",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-colors",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                    {hasChildren && (
                      <ChevronRight
                        className={cn(
                          "ml-auto h-4 w-4 text-muted-foreground transition-transform",
                          isGroupOpen && "rotate-90",
                        )}
                      />
                    )}
                  </Link>

                  {hasChildren && (
                    <AnimatePresence initial={false}>
                      {isGroupOpen && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden ml-7 mt-1 border-l border-border/60"
                        >
                          {item.children!.map((child) => {
                            const childActive = pathname === child.href;
                            return (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  className={cn(
                                    "block pl-4 pr-3 py-1.5 text-[13px] rounded-r-lg transition-colors",
                                    childActive
                                      ? "text-foreground bg-foreground/[0.04] dark:bg-white/[0.05]"
                                      : "text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  {child.label}
                                </Link>
                              </li>
                            );
                          })}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-4 py-3 border-t border-border/60 text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Dash executivo
        </div>
      </SheetContent>
    </Sheet>
  );
}
