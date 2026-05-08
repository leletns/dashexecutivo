"use client";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusDot } from "@/components/baps/status-dot";
import type { BapsEventoTrilhaRow, TrilhaStatus } from "@/lib/baps/types";

const NUCLEI_ORDER = ["face", "mama", "corporal", "gestao"] as const;

export function CongressNucleiTable({ trilhas }: { trilhas: BapsEventoTrilhaRow[] }) {
  const bySlug = new Map(trilhas.map((t) => [t.slug, t]));
  const sorted = NUCLEI_ORDER.map((slug) => bySlug.get(slug)).filter(
    (t): t is BapsEventoTrilhaRow => Boolean(t),
  );

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm shadow-sm print:break-inside-avoid">
      <div className="px-5 pt-5 pb-3 border-b border-border/50">
        <h2 className="text-sm font-semibold tracking-tight">Overview de núcleos · 5º Congresso</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Status operacional por eixo com semáforo animado (sem emojis) e detalhe executivo.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Núcleo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="min-w-[200px]">Detalhe</TableHead>
            <TableHead className="hidden md:table-cell">Palestrantes / equipe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((t) => (
            <TableRow key={t.id} className="print:break-inside-avoid">
              <TableCell>
                <StatusDot status={t.status} aria-label={`Status ${t.nome}`} />
              </TableCell>
              <TableCell className="font-medium">{t.nome}</TableCell>
              <TableCell className="capitalize text-xs text-muted-foreground">{labelStatus(t.status)}</TableCell>
              <TableCell className="text-sm text-muted-foreground leading-snug">{t.detalhe}</TableCell>
              <TableCell className="hidden md:table-cell text-xs text-muted-foreground leading-snug">
                {t.palestrantes}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function labelStatus(s: TrilhaStatus): string {
  switch (s) {
    case "success":
      return "No prazo";
    case "warning":
      return "Atenção";
    case "critical":
      return "Crítico";
    default:
      return s;
  }
}
