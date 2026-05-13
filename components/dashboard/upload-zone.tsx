"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileUp, Loader2, FileCheck2, AlertTriangle, Check, X, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardContext } from "@/components/dashboard/dashboard-context";
import { cn } from "@/lib/utils";
import type { ColumnMapping } from "@/app/api/process/route";

type Step =
  | { kind: "idle" }
  | { kind: "processing"; name: string }
  | { kind: "mapping"; name: string; data: any; mapping: ColumnMapping[]; headers: string[] }
  | { kind: "success"; name: string }
  | { kind: "error"; message: string };

const MAPS_TO_LABEL: Record<ColumnMapping["mapsTo"], string> = {
  receita: "Receita",
  despesa: "Despesa",
  lucro: "Lucro",
  ticket: "Ticket médio",
  serie_mes: "Série mensal",
  evento: "Evento",
  outros: "Outros",
};

const MAPS_TO_COLOR: Record<ColumnMapping["mapsTo"], string> = {
  receita: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  despesa: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  lucro: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  ticket: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  serie_mes: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  evento: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  outros: "bg-foreground/[0.06] text-muted-foreground",
};

export function UploadZone() {
  const { applyImported } = useDashboardContext();
  const [step, setStep] = React.useState<Step>({ kind: "idle" });
  const [drag, setDrag] = React.useState(false);
  const [editMapping, setEditMapping] = React.useState<ColumnMapping[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || step.kind === "processing") return;
    setStep({ kind: "processing", name: file.name });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/process", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if (data.mapping && data.mapping.length > 0) {
        setEditMapping(data.mapping);
        setStep({
          kind: "mapping",
          name: file.name,
          data,
          mapping: data.mapping,
          headers: data.detectedHeaders ?? [],
        });
      } else {
        applyImported(data, { glow: "emerald" });
        setStep({ kind: "success", name: file.name });
        toast.success("Indicadores sincronizados", {
          description: "Cards e gráficos foram atualizados",
        });
        setTimeout(() => setStep({ kind: "idle" }), 2400);
      }
    } catch {
      setStep({ kind: "error", message: "Não foi possível ler o documento" });
      toast.error("Falha ao processar", { description: "Tente novamente em instantes" });
      setTimeout(() => setStep({ kind: "idle" }), 3000);
    }
  };

  const confirmMapping = () => {
    if (step.kind !== "mapping") return;
    applyImported(step.data, { glow: "emerald" });
    const name = step.name;
    setStep({ kind: "success", name });
    toast.success("Dados aplicados ao painel", { description: name });
    setTimeout(() => setStep({ kind: "idle" }), 2400);
  };

  const cancelMapping = () => {
    setStep({ kind: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  };

  const updateMapTo = (idx: number, mapsTo: ColumnMapping["mapsTo"]) => {
    setEditMapping((prev) => prev.map((m, i) => (i === idx ? { ...m, mapsTo } : m)));
  };

  if (step.kind === "mapping") {
    return (
      <motion.div
        initial={{ opacity: 0, filter: "blur(4px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-sm font-semibold">Detectamos estas colunas</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">
                  {step.name} · Confirme o mapeamento antes de aplicar
                </div>
              </div>
              <button onClick={cancelMapping} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-foreground/[0.06] text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-border/60 overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-foreground/[0.02]">
                    <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Coluna</th>
                    <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Destino</th>
                    <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Confiança</th>
                  </tr>
                </thead>
                <tbody>
                  {editMapping.map((m, i) => (
                    <tr key={m.col} className="border-t border-border/40">
                      <td className="px-3 py-2 font-medium">{m.col}</td>
                      <td className="px-3 py-1.5">
                        <select
                          value={m.mapsTo}
                          onChange={(e) => updateMapTo(i, e.target.value as ColumnMapping["mapsTo"])}
                          className={cn(
                            "rounded-md px-2 py-1 text-xs font-medium border-0 outline-none cursor-pointer",
                            MAPS_TO_COLOR[m.mapsTo],
                          )}
                        >
                          {(Object.keys(MAPS_TO_LABEL) as ColumnMapping["mapsTo"][]).map((k) => (
                            <option key={k} value={k}>{MAPS_TO_LABEL[k]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={cn(
                          "text-[11px] tabular-nums font-medium",
                          m.confidence >= 0.8 ? "text-emerald-600 dark:text-emerald-400" :
                          m.confidence >= 0.5 ? "text-amber-600 dark:text-amber-400" :
                          "text-muted-foreground"
                        )}>
                          {Math.round(m.confidence * 100)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={confirmMapping}>
                <Check className="h-3.5 w-3.5" />
                Aplicar ao painel
              </Button>
              <Button size="sm" variant="outline" onClick={cancelMapping}>Cancelar</Button>
              <span className="ml-auto text-[11px] text-muted-foreground flex items-center gap-1">
                Passo 2 de 2
                <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <Card
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
      onClick={() => step.kind === "idle" && inputRef.current?.click()}
      className={cn(
        "relative cursor-pointer overflow-hidden transition-colors",
        drag && "bg-foreground/[0.04]",
        step.kind !== "idle" && "cursor-default",
      )}
    >
      <div className="p-5 flex items-center gap-4">
        <div className="h-11 w-11 rounded-xl bg-foreground/[0.06] dark:bg-white/[0.06] grid place-items-center shrink-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={step.kind}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.15 }}
              className="grid place-items-center"
            >
              {step.kind === "processing" && <Loader2 className="h-5 w-5 animate-spin" />}
              {step.kind === "success" && <FileCheck2 className="h-5 w-5 text-emerald-500" />}
              {step.kind === "error" && <AlertTriangle className="h-5 w-5 text-amber-500" />}
              {step.kind === "idle" && <FileUp className="h-5 w-5" />}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold tracking-tight">
            {step.kind === "processing" && "Lendo o documento…"}
            {step.kind === "success" && "Dados aplicados"}
            {step.kind === "error" && "Falha ao processar"}
            {step.kind === "idle" && "Importar documento"}
          </div>
          <div className="text-[12px] text-muted-foreground truncate">
            {step.kind === "processing" && step.name}
            {step.kind === "success" && `${step.name} aplicado ao painel`}
            {step.kind === "error" && step.message}
            {step.kind === "idle" && "Arraste um PDF, Excel ou print — colunas detectadas automaticamente"}
          </div>
        </div>
        <div className="hidden sm:block text-[11px] text-muted-foreground">
          {step.kind === "idle" ? "PDF · XLSX · CSV · PNG" : ""}
        </div>
      </div>

      <AnimatePresence>
        {step.kind === "processing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden"
          >
            <div
              className="h-full w-full animate-shimmer"
              style={{
                background: "linear-gradient(90deg, transparent 0%, #7C3AED 40%, #7C3AED 60%, transparent 100%)",
                backgroundSize: "200% 100%",
                opacity: 0.7,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,image/*"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </Card>
  );
}
