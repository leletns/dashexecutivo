"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Download,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDashboardContext } from "@/components/dashboard/dashboard-context";

type Cards = ReturnType<typeof useDashboardContext>["cards"];
type Series = ReturnType<typeof useDashboardContext>["series"];

export function ExportButton() {
  const { cards, series } = useDashboardContext();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const startCsv = async () => {
    if (busy) return;
    setOpen(false);
    setBusy(true);
    const id = toast.loading("Gerando exportação criptografada…", {
      description: "Compactando indicadores e séries do mês",
    });
    try {
      const filename = saveCsv(cards, series);
      toast.success("Exportação concluída", {
        id,
        description: `Arquivo ${filename} salvo no seu dispositivo`,
        icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />,
        duration: 4500,
      });
    } catch {
      toast.error("Falha ao exportar CSV", { id });
    } finally {
      setBusy(false);
    }
  };

  const startPdf = async () => {
    if (busy) return;
    setOpen(false);
    setBusy(true);
    const id = toast.loading("Gerando exportação criptografada…", {
      description: "Capturando o painel atual",
    });
    try {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const filename = await savePdfFromDom(cards, series, (stage) => {
        toast.message(stage, { id });
      });
      toast.success("Exportação concluída", {
        id,
        description: `Arquivo ${filename} salvo no seu dispositivo`,
        icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />,
        duration: 4500,
      });
    } catch (err: any) {
      toast.error("Falha ao gerar PDF", {
        id,
        description: err?.message ?? "Tente novamente em instantes",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={busy}
          className="relative h-11 px-4 rounded-2xl text-sm font-medium text-white inline-flex items-center gap-2 overflow-hidden shrink-0 disabled:opacity-70"
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
          <span className="relative z-10 whitespace-nowrap">
            {busy ? "Gerando…" : "Exportar dados em PDF ou CSV"}
          </span>
        </motion.button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1.5">
        <button
          onClick={startPdf}
          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-foreground/[0.05] dark:hover:bg-white/[0.05]"
        >
          <FileText className="h-3.5 w-3.5 text-rose-500" />
          <div className="flex flex-col leading-tight text-left">
            <span>Exportar em PDF</span>
            <span className="text-[10px] text-muted-foreground">
              Espelho fiel do painel atual
            </span>
          </div>
        </button>
        <button
          onClick={startCsv}
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

/* ---------------- helpers ---------------- */

function saveCsv(cards: Cards, series: Series) {
  const stamp = new Date().toISOString().slice(0, 10);
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

async function savePdfFromDom(
  cards: Cards,
  series: Series,
  onStage: (msg: string) => void,
) {
  if (typeof window === "undefined") throw new Error("PDF só roda no cliente");

  const root = document.querySelector("[data-export-root]") as HTMLElement | null;
  if (!root) throw new Error("Conteúdo do painel não encontrado");

  const { default: jsPDF } = await import("jspdf");
  const html2canvasMod = await import("html2canvas");
  const html2canvas: typeof import("html2canvas").default =
    (html2canvasMod as any).default ?? (html2canvasMod as any);

  onStage("Renderizando o painel em alta definição…");

  const isDark = document.documentElement.classList.contains("dark");
  const backgroundColor = isDark ? "#0a0a0c" : "#fdfcff";

  const canvas = await html2canvas(root, {
    backgroundColor,
    scale: Math.min(window.devicePixelRatio || 1, 2) * 1.25,
    useCORS: true,
    logging: false,
    windowWidth: root.scrollWidth,
    windowHeight: root.scrollHeight,
  });

  onStage("Aplicando assinatura digital…");

  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const ratio = canvas.width / pageWidth;
  const sliceHeightPx = pageHeight * ratio;

  // Capa minimalista no topo da primeira página
  drawCover(pdf, pageWidth, cards);

  let yPx = 0;
  let pageIndex = 0;
  while (yPx < canvas.height) {
    const sliceCanvas = document.createElement("canvas");
    const h = Math.min(sliceHeightPx, canvas.height - yPx);
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = h;
    const sCtx = sliceCanvas.getContext("2d");
    if (!sCtx) throw new Error("Contexto 2D indisponível");
    sCtx.fillStyle = backgroundColor;
    sCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    sCtx.drawImage(
      canvas,
      0,
      yPx,
      canvas.width,
      h,
      0,
      0,
      canvas.width,
      h,
    );
    const imgData = sliceCanvas.toDataURL("image/jpeg", 0.92);

    if (pageIndex > 0) pdf.addPage();
    if (pageIndex === 0) {
      // primeira página já tem capa; coloca o conteúdo abaixo
      const top = 96; // espaço da capa
      const usable = pageHeight - top;
      const imgHeightPt = (h / ratio) * (usable / (h / ratio));
      pdf.addImage(
        imgData,
        "JPEG",
        0,
        top,
        pageWidth,
        Math.min(usable, h / ratio),
      );
    } else {
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, h / ratio);
    }
    drawFooter(pdf, pageWidth, pageHeight, pageIndex + 1);

    yPx += sliceHeightPx;
    pageIndex += 1;
  }

  // Página final com tabela de indicadores e série mensal (texto puro p/ buscas no PDF)
  pdf.addPage();
  drawDataAppendix(pdf, pageWidth, pageHeight, cards, series);
  drawFooter(pdf, pageWidth, pageHeight, pageIndex + 1);

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `portal-executivo-${stamp}.pdf`;
  pdf.save(filename);
  return filename;
}

function drawCover(pdf: any, pageWidth: number, cards: Cards) {
  pdf.setFillColor(124, 58, 237);
  pdf.rect(0, 0, pageWidth, 64, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("Portal executivo", 24, 30);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("Visão consolidada da operação", 24, 48);

  const totalReceita = cards.find((c) => c.key === "receita")?.value ?? 0;
  const totalLucro = cards.find((c) => c.key === "lucro")?.value ?? 0;
  pdf.setFontSize(10);
  const right = pageWidth - 24;
  pdf.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    right,
    30,
    { align: "right" },
  );
  pdf.text(
    `Receita ${formatBRL(totalReceita)}  ·  Lucro ${formatBRL(totalLucro)}`,
    right,
    48,
    { align: "right" },
  );
}

function drawFooter(pdf: any, pageWidth: number, pageHeight: number, n: number) {
  pdf.setTextColor(120, 120, 120);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text(
    `Documento confidencial · Portal executivo · página ${n}`,
    pageWidth / 2,
    pageHeight - 14,
    { align: "center" },
  );
}

function drawDataAppendix(
  pdf: any,
  pageWidth: number,
  pageHeight: number,
  cards: Cards,
  series: Series,
) {
  pdf.setTextColor(20, 20, 20);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("Apêndice de dados", 24, 40);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    "Versão estruturada dos números do painel para auditoria e cruzamento.",
    24,
    56,
  );

  let y = 80;
  pdf.setTextColor(20, 20, 20);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("Indicadores macro", 24, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  y += 14;
  cards.forEach((c) => {
    pdf.text(`${c.label}`, 24, y);
    pdf.text(formatBRL(c.value), pageWidth - 24, y, { align: "right" });
    y += 14;
  });

  y += 8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Série mensal (BRL)", 24, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  y += 14;
  pdf.text("Mês", 24, y);
  pdf.text("Receita", 180, y, { align: "right" });
  pdf.text("Despesa", 280, y, { align: "right" });
  pdf.text("Lucro", 380, y, { align: "right" });
  y += 12;
  pdf.setDrawColor(220, 220, 220);
  pdf.line(24, y - 6, pageWidth - 24, y - 6);
  series.forEach((s) => {
    pdf.text(s.month, 24, y);
    pdf.text(formatBRL(s.receita), 180, y, { align: "right" });
    pdf.text(formatBRL(s.despesa), 280, y, { align: "right" });
    pdf.text(formatBRL(s.lucro), 380, y, { align: "right" });
    y += 12;
    if (y > pageHeight - 40) {
      pdf.addPage();
      y = 40;
    }
  });
}

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(v) ? v : 0);
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
