"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileUp, Loader2, FileCheck2, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { useDashboardContext } from "@/components/dashboard/dashboard-context";
import { cn } from "@/lib/utils";

type Status =
  | { kind: "idle" }
  | { kind: "processing"; name: string }
  | { kind: "success"; name: string }
  | { kind: "error"; message: string };

export function UploadZone() {
  const { applyImported } = useDashboardContext();
  const [drag, setDrag] = React.useState(false);
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setStatus({ kind: "processing", name: file.name });
    const tId = toast.loading("Processando documento…", {
      description: file.name,
    });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/process", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      applyImported(data);
      setStatus({ kind: "success", name: file.name });
      toast.success("Indicadores sincronizados", {
        id: tId,
        description: "Cards e gráficos foram atualizados",
        icon: <Sparkles className="h-4 w-4 text-[hsl(var(--brand-2))]" />,
      });
      setTimeout(() => setStatus({ kind: "idle" }), 2400);
    } catch (e: any) {
      setStatus({ kind: "error", message: "Não foi possível ler o documento" });
      toast.error("Falha ao processar", {
        id: tId,
        description: "Tente novamente em instantes",
      });
      setTimeout(() => setStatus({ kind: "idle" }), 3000);
    }
  };

  return (
    <Card
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        onFiles(e.dataTransfer.files);
      }}
      onClick={() => status.kind !== "processing" && inputRef.current?.click()}
      className={cn(
        "relative cursor-pointer overflow-hidden transition-colors",
        drag && "bg-foreground/[0.04]",
      )}
    >
      <div className="p-5 flex items-center gap-4">
        <div className="h-11 w-11 rounded-xl bg-foreground/[0.06] dark:bg-white/[0.06] grid place-items-center shrink-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={status.kind}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.15 }}
              className="grid place-items-center"
            >
              {status.kind === "processing" && (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
              {status.kind === "success" && (
                <FileCheck2 className="h-5 w-5 text-emerald-500" />
              )}
              {status.kind === "error" && (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              {status.kind === "idle" && <FileUp className="h-5 w-5" />}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold tracking-tight">
            {status.kind === "processing" && "Processando documento…"}
            {status.kind === "success" && "Dados sincronizados"}
            {status.kind === "error" && "Falha ao processar"}
            {status.kind === "idle" && "Importar documento"}
          </div>
          <div className="text-[12px] text-muted-foreground truncate">
            {status.kind === "processing" && status.name}
            {status.kind === "success" && `${status.name} aplicado aos indicadores`}
            {status.kind === "error" && status.message}
            {status.kind === "idle" &&
              "Arraste um PDF, Excel ou print de tela — os indicadores são atualizados automaticamente"}
          </div>
        </div>
        <div className="hidden sm:block text-[11px] text-muted-foreground">
          {status.kind === "idle" ? "PDF · XLSX · CSV · PNG · JPG" : ""}
        </div>
      </div>

      {/* Barra de progresso shimmer durante o processamento */}
      <AnimatePresence>
        {status.kind === "processing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden"
          >
            <div
              className="h-full w-full animate-shimmer"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, hsl(var(--foreground)) 40%, hsl(var(--foreground)) 60%, transparent 100%)",
                backgroundSize: "200% 100%",
                opacity: 0.6,
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
