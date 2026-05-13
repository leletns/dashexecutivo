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
  const filename = `dash-executivo-${stamp}.csv`;
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

  const isDark = document.documentElement.classList.contains("dark");
  const backgroundColor = isDark ? "#0a0a0c" : "#fdfcff";

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // ── Página 1: capa completa (sem captura DOM) ─────────────────────────────
  drawCover(pdf, pageWidth, pageHeight, cards);
  drawFooter(pdf, pageWidth, pageHeight, 1, true);

  // ── Páginas de conteúdo ───────────────────────────────────────────────────
  onStage("Renderizando o painel em alta definição…");

  const canvas = await html2canvas(root, {
    backgroundColor,
    scale: Math.min(window.devicePixelRatio || 1, 2) * 1.2,
    useCORS: true,
    logging: false,
    windowWidth: root.scrollWidth,
    windowHeight: root.scrollHeight,
  });

  onStage("Montando páginas do relatório…");

  const contentWidth = pageWidth;
  const contentHeight = pageHeight - 40; // margin for footer
  const ratio = canvas.width / contentWidth;
  const sliceHeightPx = contentHeight * ratio;

  let yPx = 0;
  let pageIndex = 1;
  while (yPx < canvas.height) {
    pdf.addPage();
    const h = Math.min(sliceHeightPx, canvas.height - yPx);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = h;
    const sCtx = sliceCanvas.getContext("2d");
    if (!sCtx) throw new Error("Contexto 2D indisponível");
    sCtx.fillStyle = backgroundColor;
    sCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    sCtx.drawImage(canvas, 0, yPx, canvas.width, h, 0, 0, canvas.width, h);
    pdf.addImage(sliceCanvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, contentWidth, h / ratio);
    drawFooter(pdf, pageWidth, pageHeight, pageIndex + 1, false);
    yPx += sliceHeightPx;
    pageIndex += 1;
  }

  // ── Última página: tabela de dados ────────────────────────────────────────
  onStage("Aplicando assinatura digital…");
  pdf.addPage();
  drawDataAppendix(pdf, pageWidth, pageHeight, cards, series);
  drawFooter(pdf, pageWidth, pageHeight, pageIndex + 1, false);

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `dash-executivo-${stamp}.pdf`;
  pdf.save(filename);
  return filename;
}

function drawCover(pdf: any, pageWidth: number, pageHeight: number, cards: Cards) {
  // Fundo branco limpo
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  // Faixa roxa no topo
  pdf.setFillColor(124, 58, 237);
  pdf.rect(0, 0, pageWidth, 8, "F");

  // Área central
  const centerY = pageHeight * 0.38;

  // Título
  pdf.setTextColor(20, 17, 30);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(32);
  pdf.text("Relatório Executivo", pageWidth / 2, centerY, { align: "center" });

  // Subtítulo
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(13);
  pdf.setTextColor(107, 97, 130);
  pdf.text("Portal de Gestão · Visão Consolidada da Operação", pageWidth / 2, centerY + 28, { align: "center" });

  // Linha separadora
  pdf.setDrawColor(218, 210, 240);
  pdf.setLineWidth(0.5);
  pdf.line(pageWidth * 0.25, centerY + 48, pageWidth * 0.75, centerY + 48);

  // Data de geração
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  pdf.setFontSize(10);
  pdf.setTextColor(107, 97, 130);
  pdf.text(`Gerado em ${dateStr}`, pageWidth / 2, centerY + 68, { align: "center" });

  // KPIs em mini-cards
  const kpiY = centerY + 110;
  const kpiKeys = ["receita", "despesa", "lucro", "ticket"];
  const kpiColors: Record<string, [number, number, number]> = {
    receita: [124, 58, 237],
    despesa: [229, 56, 59],
    lucro: [16, 185, 129],
    ticket: [245, 158, 11],
  };
  const cardW = (pageWidth - 80) / 4;
  kpiKeys.forEach((key, i) => {
    const card = cards.find((c) => c.key === key);
    if (!card) return;
    const x = 40 + i * (cardW + 8);
    const [r, g, b] = kpiColors[key] ?? [100, 100, 100];
    pdf.setFillColor(r, g, b);
    pdf.roundedRect(x, kpiY, cardW, 60, 6, 6, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(card.label.toUpperCase(), x + cardW / 2, kpiY + 18, { align: "center" });
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(formatBRL(card.value), x + cardW / 2, kpiY + 42, { align: "center" });
  });

  // Faixa roxa na base
  pdf.setFillColor(124, 58, 237);
  pdf.rect(0, pageHeight - 40, pageWidth, 40, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text("Documento confidencial · Uso interno restrito", pageWidth / 2, pageHeight - 16, { align: "center" });
}

function drawFooter(pdf: any, pageWidth: number, pageHeight: number, n: number, isCover: boolean) {
  if (isCover) return;
  pdf.setTextColor(150, 140, 170);
  pdf.setFontSize(7.5);
  pdf.setFont("helvetica", "normal");
  const stamp = new Date().toLocaleDateString("pt-BR");
  pdf.text(
    `Confidencial · Portal Executivo · ${stamp}`,
    24,
    pageHeight - 14,
  );
  pdf.text(`Página ${n}`, pageWidth - 24, pageHeight - 14, { align: "right" });
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
