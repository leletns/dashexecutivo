"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardContext } from "@/components/dashboard/dashboard-context";
import { cn } from "@/lib/utils";

/**
 * Envolve um conteúdo e dispara um pulso de "glow" lilás
 * sempre que o contexto sinaliza atualização (ex: importação concluída).
 */
export function GlowWrapper({
  children,
  className,
  delay = 0,
  intensity = 1,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  intensity?: number;
}) {
  const { glowing, glowToken } = useDashboardContext();

  return (
    <div className={cn("relative", className)}>
      {children}
      <AnimatePresence>
        {glowing && (
          <motion.span
            key={glowToken}
            aria-hidden
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{
              opacity: [0, 0.9 * intensity, 0.4 * intensity, 0],
              scale: [0.97, 1.005, 1.012, 1],
              boxShadow: [
                "0 0 0 0 hsl(var(--brand-1) / 0)",
                `0 0 0 6px hsl(var(--brand-1) / ${0.18 * intensity})`,
                `0 0 36px 8px hsl(var(--brand-2) / ${0.28 * intensity})`,
                "0 0 0 0 hsl(var(--brand-1) / 0)",
              ],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, delay, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{ borderRadius: "inherit" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
