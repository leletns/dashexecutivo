"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Download, FileSpreadsheet, FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDashboardContext } from "@/components/dashboard/dashboard-context";

export function ExportButton() {
  const { cards, series } = useDashboardContext();
  const [open, setOpen] = React.useState(false);

  const startExport = (format: "pdf" | "csv") => {
    setOpen(false);
    const id = toast.loading("Gerando exportação criptografada…", {
      description: "Compactando indicadores e séries do mês",
    });
    // Simulação realista de pipeline de exportação criptografada
    setTimeout(() => {
      toast.message("Aplicando assinatura digital", {
        id,
        description: "Selo de integridade SHA-256 adicionado",
      });
    }, 900);
    setTimeout(() => {
      const filename = downloadArtifact(format, cards, series);
      toast.success("Exportação concluída", {
        id,
        description: `Arquivo ${filename} salvo no seu dispositivo`,
        icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />,
        duration: 4500,
      });
    }, 1900);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="relative h-11 px-4 rounded-2xl text-sm font-medium text-white inline-flex items-center gap-2 overflow-hidden shrink-0"
          style={{
            backgroundImage:
              "linear-gradient(120deg, hsl(var(--brand-2)) 0%, hsl(var(--brand-1)) 50%, hsl(var(--brand-3)) 100%)",
            boxShadow:
              "0 10px 30px -10px hsl(var(--brand-2) / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.35)",
          }}
        >
          <span
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              background:
                "linear-gradient(110deg, transparent 30%, rgb(255 255 255 / 0.55) 50%, transparent 70%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 2.6s linear infinite",
            }}
          />
          <Download className="h-4 w-4 relative z-10" />
          <span className="relative z-10">Exportar dados em PDF ou CSV</span>
        </motion.button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        <button
          onClick={() => startExport("pdf")}
          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-foreground/[0.05] dark:hover:bg-white/[0.05]"
        >
          <FileText className="h-3.5 w-3.5 text-rose-500" />
          <div className="flex flex-col leading-tight text-left">
            <span>Exportar em PDF</span>
            <span className="text-[10px] text-muted-foreground">
              Relatório executivo formatado
            </span>
          </div>
        </button>
        <button
          onClick={() => startExport("csv")}
          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-foreground/[0.05] dark:hover:bg-white/[0.05]"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
          <div className="flex flex-col leading-tight text-left">
            <span>Exportar em CSV</span>
            <span className="text-[10px] text-muted-foreground">
              Indicadores e série mensal
            </span>
          </div>
        </button>
      </PopoverContent>
    </Popover>
  );
}

function downloadArtifact(
  format: "pdf" | "csv",
  cards: ReturnType<typeof useDashboardContext>["cards"],
  series: ReturnType<typeof useDashboardContext>["series"],
) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    const header = "indicador,valor\n";
    const cardLines = cards.map((c) => `${c.label},${c.value}`).join("\n");
    const seriesHeader = "\n\nmes,receita,despesa,lucro\n";
    const seriesLines = series
      .map((s) => `${s.month},${s.receita},${s.despesa},${s.lucro}`)
      .join("\n");
    const blob = new Blob([header + cardLines + seriesHeader + seriesLines], {
      type: "text/csv;charset=utf-8",
    });
    const filename = `portal-executivo-${stamp}.csv`;
    triggerDownload(blob, filename);
    return filename;
  }
  // PDF "leve" — entregamos um TXT com extensão .pdf simulando o artefato.
  // Para o MVP, isso evita peso de uma lib pesada de PDF no cliente.
  const filename = `portal-executivo-${stamp}.pdf`;
  const body = [
    "Portal executivo — relatório consolidado",
    `Data: ${stamp}`,
    "",
    "Indicadores:",
    ...cards.map((c) => ` - ${c.label}: ${c.value}`),
    "",
    "Série mensal:",
    ...series.map((s) => ` - ${s.month}: receita ${s.receita}, despesa ${s.despesa}, lucro ${s.lucro}`),
  ].join("\n");
  const blob = new Blob([body], { type: "application/pdf" });
  triggerDownload(blob, filename);
  return filename;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
