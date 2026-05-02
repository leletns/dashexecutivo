"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { NAV } from "@/components/layout/nav";

export function Sidebar() {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = React.useState<string | null>("/eventos");

  return (
    <aside className="hidden md:flex md:w-64 lg:w-72 flex-col shrink-0 h-svh sticky top-0 px-4 py-5">
      <div className="glass rounded-2xl flex flex-col h-full overflow-hidden">
        <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
          <Logo size={34} withGlow />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">
              Portal executivo
            </span>
            <span className="text-[11px] text-muted-foreground">
              Visão consolidada
            </span>
          </div>
        </div>

        <nav className="px-2.5 pb-3 flex-1 overflow-y-auto">
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
                  <div className="flex items-center">
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex flex-1 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-foreground/[0.06] dark:bg-white/[0.07] text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] dark:hover:bg-white/[0.04]",
                      )}
                      onClick={() => hasChildren && setOpenGroup(item.href)}
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
                  </div>

                  {hasChildren && (
                    <AnimatePresence initial={false}>
                      {isGroupOpen && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
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

        <div className="px-4 py-3 border-t border-border/60">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-foreground/80 to-foreground/40 grid place-items-center text-background text-[11px] font-semibold">
              LD
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-medium">Ludymilla</span>
              <span className="text-[11px] text-muted-foreground">CEO</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
