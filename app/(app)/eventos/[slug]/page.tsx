"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EdicaoDetail } from "@/components/dashboard/edicao-detail";
import { useAppState, metricasEdicao } from "@/lib/app-state";
import { useRegisterPageState } from "@/lib/page-state";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/utils";

export default function EdicaoPage({ params }: { params: { slug: string } }) {
  const { state, hydrated } = useAppState();
  const ed = state.edicoes.find((e) => e.slug === params.slug);

  const metricas = ed ? metricasEdicao(ed) : null;

  useRegisterPageState({
    module: ed ? `Produção de eventos · ${ed.nome}` : "Produção de eventos",
    summary: ed && metricas
      ? [
          { label: "Receita de ingressos", value: formatCurrencyBRL(metricas.receitaIngressos) },
          { label: "Patrocínios", value: formatCurrencyBRL(ed.patrocinio) },
          { label: "Público confirmado", value: formatNumberBR(metricas.totalVendidos) },
          { label: "Ocupação", value: `${metricas.ocupacao}%` },
          { label: "Margem da edição", value: `${metricas.margemPct}%` },
        ]
      : [],
  });

  if (hydrated && !ed) {
    return (
      <div className="space-y-4">
        <Header backHref="/eventos" title="Edição não encontrada" subtitle="A edição pode ter sido removida do painel." />
        <div className="rounded-2xl glass p-10 text-center text-sm text-muted-foreground">
          Volte para a lista e selecione uma edição existente, ou crie uma nova.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header
        backHref="/eventos"
        title={ed?.nome ?? "Carregando edição…"}
        subtitle={ed ? `${ed.cidade} · ${ed.data}` : "Sincronizando dados locais"}
      />
      {ed && <EdicaoDetail slug={ed.slug} />}
    </div>
  );
}

function Header({
  backHref,
  title,
  subtitle,
}: {
  backHref: string;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-end justify-between flex-wrap gap-3"
    >
      <div className="min-w-0">
        <Link href={backHref} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Todas as edições
        </Link>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 mt-1">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          {title}
        </h1>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <Button variant="glass" asChild>
        <Link href="/eventos">Voltar à lista</Link>
      </Button>
    </motion.div>
  );
}
