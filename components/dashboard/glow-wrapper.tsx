"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardContext } from "@/components/dashboard/dashboard-context";
import { cn } from "@/lib/utils";

/**
 * Envolve um conteúdo e dispara um pulso de "glow" sempre
 * que o contexto sinaliza atualização (ex: importação concluída).
 *
 * Suporta variantes de cor:
 *  - "brand": pulso lilás (atualizações automáticas / inline edit)
 *  - "emerald": pulso verde-esmeralda (atualizações confirmadas pela CEO via chat)
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
  const { glowing, glowToken, glowVariant } = useDashboardContext();

  // Cores base (sem alpha) — `withAlpha` aplica a opacidade dinâmica.
  const palette =
    glowVariant === "emerald"
      ? { space: "rgb" as const, ring: "16 185 129", spread: "16 185 129" }
      : {
          space: "hsl" as const,
          ring: "var(--brand-1)",
          spread: "var(--brand-2)",
        };

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
                "0 0 0 0 rgba(0,0,0,0)",
                `0 0 0 6px ${withAlpha(palette.space, palette.ring, 0.18 * intensity)}`,
                `0 0 36px 8px ${withAlpha(palette.space, palette.spread, 0.42 * intensity)}`,
                "0 0 0 0 rgba(0,0,0,0)",
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

/**
 * Compõe uma cor CSS no formato moderno `rgb(R G B / a)` ou `hsl(H S% L% / a)`,
 * aceitando tanto componentes literais ("16 185 129", "268 90% 70%") quanto
 * variáveis CSS ("var(--brand-1)" cujo valor é "268 90% 70%"). A opacidade
 * é clamada em [0, 1] para evitar valores inválidos durante a animação.
 */
function withAlpha(space: "rgb" | "hsl", components: string, alpha: number) {
  const a = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 0));
  return `${space}(${components} / ${a})`;
}
