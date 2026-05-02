"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";

export function SectionPlaceholder({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-xs text-muted-foreground">{description}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <Card className="p-10 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-foreground/[0.05] dark:bg-white/[0.05] grid place-items-center text-muted-foreground">
            {icon}
          </div>
          <div className="max-w-md space-y-1">
            <div className="text-sm font-semibold tracking-tight">Em construção</div>
            <p className="text-xs text-muted-foreground">
              Esta área será personalizada com indicadores próprios. A estrutura visual e
              o tema acompanham o painel principal.
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
