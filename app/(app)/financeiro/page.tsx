"use client";

import { motion } from "framer-motion";
import { Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AutoConciliacaoSheet } from "@/components/dashboard/auto-conciliacao-sheet";
import { useRegisterPageState } from "@/lib/page-state";

export default function FinanceiroPage() {
  useRegisterPageState({
    module: "Financeiro",
    summary: [
      { label: "Conciliações pendentes", value: 6 },
      { label: "Saldo conferido", value: "R$ 254.250" },
    ],
  });

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-end justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-xs text-muted-foreground">
            Fluxo de caixa, contas e conciliação bancária
          </p>
        </div>
        <AutoConciliacaoSheet />
      </motion.div>

      <Card className="p-10 flex flex-col items-center text-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-foreground/[0.05] dark:bg-white/[0.05] grid place-items-center">
          <Wallet className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="max-w-md space-y-1">
          <div className="text-sm font-semibold tracking-tight">Painel financeiro</div>
          <p className="text-xs text-muted-foreground">
            Em breve: fluxo de caixa, contas a pagar e a receber, e indicadores de margem por
            evento. A auto-conciliação já está disponível no botão acima.
          </p>
        </div>
      </Card>
    </div>
  );
}
