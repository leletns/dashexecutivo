"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BAPS_DEFAULT_SNAPSHOT } from "@/lib/baps/defaults";
import type { BapsCongressoDisponibilidadeRow } from "@/lib/baps/types";
import { parseLooseNumber } from "@/lib/utils";

async function postMutate(kind: string, data: Record<string, unknown>) {
  const res = await fetch("/api/baps/mutate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, data }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Falha ao gravar");
}

function stringifyRow(r: BapsCongressoDisponibilidadeRow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    if (k === "id") continue;
    out[k] = String(v);
  }
  return out;
}

export function FormCongressoDisponibilidade() {
  const base = BAPS_DEFAULT_SNAPSHOT.congresso_disponibilidade;
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [st, setSt] = React.useState<Record<string, string>>(() => stringifyRow(base));

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/baps/snapshot", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { congresso_disponibilidade?: BapsCongressoDisponibilidadeRow };
        if (!cancelled && json.congresso_disponibilidade) {
          setSt(stringifyRow(json.congresso_disponibilidade));
        }
      } catch {
        /* mantém base */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ch = (key: string, value: string) => setSt((s) => ({ ...s, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(st)) {
        if (k === "referencia") payload[k] = String(v).trim();
        else payload[k] = Math.round(parseLooseNumber(String(v)));
      }
      await postMutate("congresso_disponibilidade", payload);
      toast.success("5º Congresso · disponibilidade salva no Supabase.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao gravar");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 rounded-2xl border-border/60">
        <p className="text-sm text-muted-foreground">Carregando números atuais…</p>
      </Card>
    );
  }

  const fg = "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-border/60 space-y-6">
      <div>
        <h2 className="text-sm font-semibold">5º Congresso · disponibilidade</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Todos os campos são numéricos exceto a referência (ex.: mai/2026). Ao salvar, atualiza o painel executivo e a tabela
          “disponibilidade e vendas”.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-8">
        <div className="space-y-2 max-w-xs">
          <label className={fg}>Referência</label>
          <Input value={st.referencia ?? ""} onChange={(e) => ch("referencia", e.target.value)} className="rounded-xl" />
        </div>

        <section className="space-y-3">
          <h3 className={fg}>Público e operações</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Num label="Congressistas CP" k="congressistas_cp" st={st} ch={ch} />
            <Num label="Residentes" k="residentes" st={st} ch={ch} />
            <Num label="Gestores" k="gestores" st={st} ch={ch} />
            <Num label="Pré e pós" k="pre_pos" st={st} ch={ch} />
            <Num label="Videomakers" k="videomakers" st={st} ch={ch} />
            <Num label="Staffs (geral)" k="staffs" st={st} ch={ch} />
            <Num label="Staffs patrocínio" k="staffs_patrocinio" st={st} ch={ch} />
            <Num label="Visitantes" k="visitantes" st={st} ch={ch} />
            <Num label="Lab Face" k="lab_face" st={st} ch={ch} />
            <Num label="Lab corporal" k="lab_corporal" st={st} ch={ch} />
            <Num label="BAPS in the house" k="baps_in_the_house" st={st} ch={ch} />
            <Num label="Inscritos (total)" k="inscritos_total" st={st} ch={ch} />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className={fg}>Gestão · congressistas</h3>
          <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
            <Num label="Congressistas pagantes" k="congressistas_pagantes" st={st} ch={ch} />
            <Num label="Congressistas isentos" k="congressistas_isentos" st={st} ch={ch} />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className={fg}>Palestrantes por núcleo (isentos / pagantes)</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Num label="Face · isentos" k="pal_face_isentos" st={st} ch={ch} />
            <Num label="Face · pagantes" k="pal_face_pagantes" st={st} ch={ch} />
            <Num label="Mama · isentos" k="pal_mama_isentos" st={st} ch={ch} />
            <Num label="Mama · pagantes" k="pal_mama_pagantes" st={st} ch={ch} />
            <Num label="Corporal · isentos" k="pal_corporal_isentos" st={st} ch={ch} />
            <Num label="Corporal · pagantes" k="pal_corporal_pagantes" st={st} ch={ch} />
            <Num label="Gestão · isentos" k="pal_gestao_isentos" st={st} ch={ch} />
            <Num label="Gestão · pagantes" k="pal_gestao_pagantes" st={st} ch={ch} />
            <Num label="Pré/Pós · isentos" k="pal_prepos_isentos" st={st} ch={ch} />
            <Num label="Pré/Pós · pagantes" k="pal_prepos_pagantes" st={st} ch={ch} />
          </div>
        </section>

        <Button type="submit" disabled={busy} className="rounded-xl">
          {busy ? "Gravando…" : "Salvar disponibilidade"}
        </Button>
      </form>
    </Card>
  );
}

function Num({
  label,
  k,
  st,
  ch,
}: {
  label: string;
  k: string;
  st: Record<string, string>;
  ch: (key: string, value: string) => void;
}) {
  const fg = "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
  return (
    <div className="space-y-1.5">
      <label className={fg}>{label}</label>
      <Input
        inputMode="numeric"
        value={st[k] ?? "0"}
        onChange={(e) => ch(k, e.target.value)}
        className="rounded-xl tabular-nums"
      />
    </div>
  );
}
