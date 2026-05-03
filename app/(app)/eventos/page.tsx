"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Select, type SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EdicaoDetail } from "@/components/dashboard/edicao-detail";
import { EdicaoFormDialog } from "@/components/dashboard/edicao-form-dialog";
import { useAppState, metricasEdicao } from "@/lib/app-state";
import { useRegisterPageState } from "@/lib/page-state";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/utils";

export default function EventosPage() {
  const { state } = useAppState();
  const [slug, setSlug] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    if (!state.edicoes.length) {
      setSlug(null);
      return;
    }
    const exists = slug && state.edicoes.some((e) => e.slug === slug);
    if (!exists) setSlug(state.edicoes[0].slug);
  }, [state.edicoes, slug]);

  const ed = slug ? state.edicoes.find((e) => e.slug === slug) ?? null : null;
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

  const options: SelectOption[] = state.edicoes.map((e) => ({
    value: e.slug,
    label: e.nome,
    hint: e.data,
  }));

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-end justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Produção de eventos
          </h1>
          <p className="text-xs text-muted-foreground">
            Acompanhamento operacional e comercial das edições anuais ·{" "}
            {state.edicoes.length} edições ativas
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {state.edicoes.length > 0 && slug && (
            <Select
              value={slug}
              onValueChange={setSlug}
              options={options}
              triggerClassName="min-w-[260px]"
            />
          )}
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova edição
          </Button>
        </div>
      </motion.div>

      {ed ? (
        <EdicaoDetail slug={ed.slug} />
      ) : (
        <div className="rounded-2xl glass p-10 text-center text-sm text-muted-foreground">
          Nenhuma edição cadastrada ainda. Crie a primeira para começar.
        </div>
      )}

      <EdicaoFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode={{ kind: "create" }}
        onSaved={(novo) => setSlug(novo.slug)}
      />
    </div>
  );
}
