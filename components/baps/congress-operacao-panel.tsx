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
import type { BapsSnapshot } from "@/lib/baps/types";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/utils";

export function CongressOperacaoPanel({ data }: { data: BapsSnapshot }) {
  const c = data.congresso_disponibilidade;

  const nucleos = [
    { nome: "Face", isento: c.pal_face_isentos, pagante: c.pal_face_pagantes },
    { nome: "Mama", isento: c.pal_mama_isentos, pagante: c.pal_mama_pagantes },
    { nome: "Corporal", isento: c.pal_corporal_isentos, pagante: c.pal_corporal_pagantes },
    { nome: "Gestão", isento: c.pal_gestao_isentos, pagante: c.pal_gestao_pagantes },
    { nome: "Pré/Pós", isento: c.pal_prepos_isentos, pagante: c.pal_prepos_pagantes },
  ];

  const dispItems: { label: string; value: number }[] = [
    { label: "Congressistas CP", value: c.congressistas_cp },
    { label: "Residentes", value: c.residentes },
    { label: "Gestores", value: c.gestores },
    { label: "Pré e pós", value: c.pre_pos },
    { label: "Videomakers", value: c.videomakers },
    { label: "Staffs geral", value: c.staffs },
    { label: "Staffs patrocínio", value: c.staffs_patrocinio },
    { label: "Visitantes", value: c.visitantes },
    { label: "Lab Face", value: c.lab_face },
    { label: "Lab corporal", value: c.lab_corporal },
    { label: "BAPS in the house", value: c.baps_in_the_house },
    { label: "Inscritos (total consolidado)", value: c.inscritos_total },
  ];

  return (
    <Card className="rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden print:break-inside-avoid">
      <div className="px-5 pt-5 pb-3 border-b border-border/50">
        <h2 className="text-sm font-semibold tracking-tight">5º Congresso · disponibilidade e vendas</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Referência: <span className="font-medium text-foreground">{c.referencia}</span>.
        </p>
      </div>

      <div className="p-5 space-y-8">
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Disponibilidade / ocupação
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {dispItems.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-border/50 bg-foreground/[0.02] dark:bg-white/[0.03] px-3 py-2.5"
              >
                <div className="text-[10px] text-muted-foreground leading-tight">{item.label}</div>
                <div className="text-lg font-semibold tabular-nums mt-0.5">{formatNumberBR(item.value)}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Gestão · congressistas
          </h3>
          <div className="grid gap-2 sm:grid-cols-3 max-w-2xl">
            <Stat label="Congressistas pagantes" value={c.congressistas_pagantes} />
            <Stat label="Congressistas isentos" value={c.congressistas_isentos} />
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Palestrantes por núcleo (inscritos isentos × pagantes)
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Núcleo</TableHead>
                <TableHead className="text-right tabular-nums">Isentos</TableHead>
                <TableHead className="text-right tabular-nums">Pagantes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nucleos.map((n) => (
                <TableRow key={n.nome}>
                  <TableCell className="font-medium">{n.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumberBR(n.isento)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumberBR(n.pagante)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Total de vendas por evento (receitas consolidadas)
          </h3>
          {data.financeiro_eventos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum evento cadastrado. Inclua em Entrada de dados → Financeiro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead className="text-right">Vendas (receitas)</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Despesas pagas</TableHead>
                  <TableHead className="hidden md:table-cell">Referência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.financeiro_eventos.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="font-medium">{ev.nome_evento}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{ev.cidade || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {formatCurrencyBRL(ev.receitas)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                      {formatCurrencyBRL(ev.despesas_pagas)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden md:table-cell max-w-[220px]">
                      {ev.referencia}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {data.financeiro_eventos.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-3">
              Resultado por evento (receitas − despesas):{" "}
              {data.financeiro_eventos
                .map((ev) => `${ev.nome_evento}: ${formatCurrencyBRL(ev.receitas - ev.despesas_pagas)}`)
                .join(" · ")}
            </p>
          )}
        </section>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/50 px-3 py-2.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{formatNumberBR(value)}</div>
    </div>
  );
}
