"use client";

import { AlertTriangle, FileWarning, Gavel } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BapsSnapshot } from "@/lib/baps/types";
import { certidaoAlertaSemestral, diasDesdeEmissaoCertidao } from "@/lib/baps/executive-metrics";
import { formatNumberBR } from "@/lib/utils";

const CASOS = [
  {
    id: "salvador",
    titulo: "Caso Salvador",
    detalhe: "Operação logística premium · cláusulas de SLA, multa simétrica e ronda de assinaturas.",
  },
  {
    id: "noronha",
    titulo: "Cabeças de Noronha",
    detalhe: "Contingenciamento de pagamentos até homologação do escopo; parecer externo arquivado no dossiê.",
  },
] as const;

export function InstitutionalRiskPanel({ data }: { data: BapsSnapshot }) {
  const certRows = data.certidoes.map((c) => ({
    ...c,
    dias: diasDesdeEmissaoCertidao(c.data_ultima_emissao),
    semestral: certidaoAlertaSemestral(c.data_ultima_emissao),
  }));

  return (
    <aside className="space-y-4 print:break-inside-avoid">
      <Card className="rounded-2xl border-border/60 bg-card/85 backdrop-blur-sm shadow-sm overflow-hidden print:bg-white print:border">
        <div className="px-5 pt-5 pb-3 border-b border-border/50 flex items-start gap-2">
          <Gavel className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold tracking-tight leading-tight">Análise de risco institucional</h2>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Temas sensíveis na carteira e ciclo semestral de certidões (alerta se ≥ 180 dias desde a última emissão).
            </p>
          </div>
        </div>
        <ul className="px-5 py-4 space-y-3">
          {CASOS.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-border/50 bg-foreground/[0.02] dark:bg-white/[0.03] px-3.5 py-3"
            >
              <p className="text-sm font-medium text-foreground leading-snug">{c.titulo}</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{c.detalhe}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="rounded-2xl border-border/60 bg-card/85 backdrop-blur-sm shadow-sm overflow-hidden print:bg-white print:border">
        <div className="px-5 pt-4 pb-2 flex items-center gap-2 text-muted-foreground">
          <FileWarning className="h-4 w-4" aria-hidden />
          <h3 className="text-xs font-semibold uppercase tracking-wider">Certidões semestrais</h3>
        </div>
        <ul className="px-5 pb-4 space-y-2.5">
          {certRows.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-1 rounded-lg border border-border/40 px-3 py-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground leading-snug">{c.nome}</span>
                {c.semestral && (
                  <Badge variant="warning" className="shrink-0 text-[10px] gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Revisar
                  </Badge>
                )}
              </div>
              <span className="text-muted-foreground tabular-nums">
                Última emissão há {formatNumberBR(c.dias)} dias
                {c.semestral ? " · janela semestral" : " · dentro do intervalo sugerido"}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </aside>
  );
}
