"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftRight, CheckCircle2, RefreshCw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatCurrencyBRL, cn } from "@/lib/utils";

type Row = {
  id: string;
  date: string;
  description: string;
  amount: number;
};

type Pair = { extrato: Row; sistema: Row };

const EXTRATO: Row[] = [
  { id: "e1", date: "02/08", description: "Recebimento — Patrocínio Aurora", amount: 145000 },
  { id: "e2", date: "05/08", description: "Pagamento — Locação espaço", amount: -38000 },
  { id: "e3", date: "08/08", description: "Recebimento — Lote ingressos VIP", amount: 86200 },
  { id: "e4", date: "12/08", description: "Pagamento — Equipe técnica", amount: -22400 },
  { id: "e5", date: "18/08", description: "Recebimento — Patrocínio Vega", amount: 98000 },
  { id: "e6", date: "22/08", description: "Pagamento — Marketing digital", amount: -14750 },
];

const SISTEMA: Row[] = [
  { id: "s2", date: "05/08", description: "Locação · contrato #882", amount: -38000 },
  { id: "s1", date: "02/08", description: "Patrocínio Aurora · NF 2034", amount: 145000 },
  { id: "s5", date: "18/08", description: "Patrocínio Vega · NF 2041", amount: 98000 },
  { id: "s3", date: "08/08", description: "Ingressos VIP · lote 1", amount: 86200 },
  { id: "s6", date: "22/08", description: "Mídia paga · agosto", amount: -14750 },
  { id: "s4", date: "12/08", description: "Folha técnica · evento", amount: -22400 },
];

export function AutoConciliacaoSheet() {
  const [open, setOpen] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [matches, setMatches] = React.useState<Pair[]>([]);

  const reset = () => {
    setMatches([]);
    setRunning(false);
  };

  const start = async () => {
    setMatches([]);
    setRunning(true);
    const pairs: Pair[] = EXTRATO.map((e) => {
      const s = SISTEMA.find((x) => x.amount === e.amount && x.date === e.date)!;
      return { extrato: e, sistema: s };
    });
    for (const p of pairs) {
      await new Promise((r) => setTimeout(r, 420));
      setMatches((prev) => [...prev, p]);
    }
    setRunning(false);
  };

  React.useEffect(() => {
    if (!open) reset();
  }, [open]);

  const matchedExtrato = new Set(matches.map((m) => m.extrato.id));
  const matchedSistema = new Set(matches.map((m) => m.sistema.id));

  const total = matches.reduce((acc, m) => acc + m.extrato.amount, 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="glass" className="gap-2">
          <ArrowLeftRight className="h-4 w-4" />
          Auto-conciliação bancária
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                Auto-conciliação bancária
              </SheetTitle>
              <SheetDescription>
                Cruzamento automático entre extrato bancário e lançamentos do sistema.
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={reset} disabled={running}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Reiniciar
              </Button>
              <Button onClick={start} disabled={running} size="sm">
                {running ? "Conciliando…" : "Iniciar"}
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-4 px-6 py-4 flex-1 overflow-hidden">
          <Column title="Extrato bancário" hint="Origem: banco">
            {EXTRATO.map((row) => (
              <RowItem key={row.id} row={row} matched={matchedExtrato.has(row.id)} />
            ))}
          </Column>
          <Column title="Lançamentos do sistema" hint="Origem: ERP interno">
            {SISTEMA.map((row) => (
              <RowItem key={row.id} row={row} matched={matchedSistema.has(row.id)} mirrored />
            ))}
          </Column>
        </div>

        <div className="border-t border-border/60 px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{matches.length}</span> de{" "}
            {EXTRATO.length} lançamentos conciliados
          </div>
          <div className="text-sm font-semibold tabular-nums">
            Saldo conferido: {formatCurrencyBRL(total)}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Column({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div className="px-1 pb-2">
        <div className="text-xs font-semibold tracking-tight">{title}</div>
        <div className="text-[10px] text-muted-foreground">{hint}</div>
      </div>
      <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-1.5">{children}</div>
    </div>
  );
}

function RowItem({
  row,
  matched,
  mirrored,
}: {
  row: Row;
  matched: boolean;
  mirrored?: boolean;
}) {
  const isCredit = row.amount > 0;
  return (
    <motion.div
      animate={{
        backgroundColor: matched
          ? "rgba(16,185,129,0.08)"
          : "rgba(127,127,127,0.03)",
        borderColor: matched ? "rgba(16,185,129,0.45)" : "rgba(127,127,127,0.12)",
      }}
      transition={{ duration: 0.4 }}
      className={cn(
        "rounded-xl border px-3 py-2.5 flex items-center justify-between gap-3",
        mirrored && "flex-row-reverse text-right",
      )}
    >
      <div className={cn("min-w-0", mirrored && "text-right")}>
        <div className="text-[11px] text-muted-foreground">{row.date}</div>
        <div className="text-xs font-medium truncate">{row.description}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/80",
          )}
        >
          {formatCurrencyBRL(row.amount)}
        </span>
        <AnimatePresence>
          {matched && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="grid place-items-center h-5 w-5 rounded-full bg-emerald-500 text-white"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
