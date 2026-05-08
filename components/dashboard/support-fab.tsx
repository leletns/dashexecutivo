"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Send,
  X,
  Paperclip,
  ExternalLink,
  Loader2,
  Check,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import { useDashboardContext, type IndicatorKey } from "@/components/dashboard/dashboard-context";
import { usePageState } from "@/lib/page-state";
import { useAppState, type FinanceCategoria, type FinanceLancamento } from "@/lib/app-state";
import { useProfile } from "@/lib/profile";
import { Logo } from "@/components/brand/logo";

const WHATSAPP_NUMBER = "5521987587947";

const FRUSTRATION_KEYWORDS = [
  "não funciona",
  "nao funciona",
  "nao consigo",
  "não consigo",
  "ruim",
  "péssimo",
  "pessimo",
  "horrível",
  "horrivel",
  "está quebrado",
  "esta quebrado",
  "não está funcionando",
  "nao esta funcionando",
  "frustrante",
  "irritante",
  "cansei",
  "ajuda urgente",
  "urgente",
  "bug",
  "erro",
  "travou",
  "trava",
];

type AssistantAction =
  | { type: "update_card"; key: IndicatorKey; value: number }
  | {
      type: "patch_edicao";
      slug: string;
      patch: Partial<{
        nome: string;
        cidade: string;
        data: string;
        capacidade: number;
        patrocinio: number;
        custoProducao: number;
      }>;
    }
  | {
      type: "patch_lote";
      slug: string;
      loteIndex: number;
      patch: Partial<{ nome: string; preco: number; vendidos: number; estoque: number }>;
    }
  | {
      type: "add_lancamento";
      tipo: "receita" | "despesa";
      descricao: string;
      categoria: FinanceCategoria;
      valor: number;
      vencimento: string;
      pagamento?: string | null;
      edicaoSlug?: string | null;
    }
  | { type: "toggle_pago"; id: string; pago: boolean }
  | { type: "remove_lancamento"; id: string };

type ChatItem =
  | {
      kind: "msg";
      role: "user" | "assistant";
      content: string;
      escalate?: boolean;
      actionsApplied?: string[];
    }
  | {
      kind: "import-confirm";
      filename: string;
      module: string;
      payload: any;
      decided?: "accepted" | "rejected";
    };

type Status = "idle" | "thinking" | "uploading";

export function SupportFab() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const ctx = useDashboardContext();
  const page = usePageState();
  const appState = useAppState();
  const { profile } = useProfile();
  const pathname = usePathname();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  const [items, setItems] = React.useState<ChatItem[]>([
    {
      kind: "msg",
      role: "assistant",
      content:
        "Olá. Estou conectado ao painel inteiro: edições, financeiro, indicadores. Pergunte o que quiser — receita, margem por evento, registrar um pagamento, ajustar uma edição, ou até que dia é hoje.",
    },
  ]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, open, status]);

  const moduleSummary = React.useMemo(() => {
    const baseSummary =
      page.summary && page.summary.length > 0
        ? page.summary.map((s) => `${s.label}: ${s.value}`).join(" · ")
        : ctx.cards
            .map((c) => `${c.label}: ${formatCurrencyBRL(c.value)}`)
            .join(" · ");
    return baseSummary;
  }, [page.summary, ctx.cards]);

  const buildContext = React.useCallback(
    () => ({
      module: page.module,
      page: pathname ?? undefined,
      indicators: ctx.cards,
      series: ctx.series,
      summary: page.summary,
      profile: { name: profile.name, role: profile.role },
      appState: {
        edicoes: appState.state.edicoes,
        financeiro: appState.state.financeiro,
      },
    }),
    [appState.state, ctx.cards, ctx.series, page.module, page.summary, pathname, profile.name, profile.role],
  );

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || status !== "idle") return;
    const next: ChatItem[] = [
      ...items,
      { kind: "msg", role: "user", content: text },
    ];
    setItems(next);
    if (!override) setInput("");
    setStatus("thinking");

    const isFrustrated = detectFrustration(text);

    try {
      const messagesForApi = next
        .filter((it): it is Extract<ChatItem, { kind: "msg" }> => it.kind === "msg")
        .map(({ role, content }) => ({ role, content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesForApi,
          context: buildContext(),
        }),
      });
      const data = await res.json();
      const rawReply: string = data.reply ?? "Não consegui responder agora.";
      const { display, actions } = extractActions(rawReply);
      const applied = actions.length > 0 ? applyActions(actions, ctx, appState) : [];

      setItems((m) => [
        ...m,
        {
          kind: "msg",
          role: "assistant",
          content: display.trim() || rawReply,
          escalate: isFrustrated,
          actionsApplied: applied,
        },
      ]);
    } catch {
      setItems((m) => [
        ...m,
        {
          kind: "msg",
          role: "assistant",
          content:
            "Falha temporária na sincronização. Posso te conectar com o suporte humano?",
          escalate: true,
        },
      ]);
    } finally {
      setStatus("idle");
    }
  };

  const onPickFile = () => fileRef.current?.click();

  const onFileSelected = async (file?: File) => {
    if (!file || status !== "idle") return;
    setItems((m) => [
      ...m,
      {
        kind: "msg",
        role: "user",
        content: `Anexei o documento: ${file.name}`,
      },
    ]);
    setStatus("uploading");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/process", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const moduleGuess = page.module || "Visão geral";
      setItems((m) => [
        ...m,
        {
          kind: "msg",
          role: "assistant",
          content: `Identifiquei dados de ${moduleGuess}. Posso atualizar o painel?`,
        },
        { kind: "import-confirm", filename: file.name, module: moduleGuess, payload: data },
      ]);
    } catch {
      setItems((m) => [
        ...m,
        {
          kind: "msg",
          role: "assistant",
          content: "Não consegui ler esse arquivo. Tente novamente em outro formato.",
        },
      ]);
    } finally {
      setStatus("idle");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const decide = (idx: number, decision: "accepted" | "rejected") => {
    const target = items[idx];
    if (!target || target.kind !== "import-confirm" || target.decided) return;

    setItems((prev) =>
      prev.map((it, i) =>
        i === idx && it.kind === "import-confirm"
          ? { ...it, decided: decision }
          : it,
      ),
    );

    if (decision === "accepted") {
      ctx.applyImported(target.payload, { glow: "emerald" });
      setItems((m) => [
        ...m,
        {
          kind: "msg",
          role: "assistant",
          content:
            "Painel atualizado em tempo real. Os cards correspondentes acabaram de pulsar em verde.",
        },
      ]);
    } else {
      setItems((m) => [
        ...m,
        {
          kind: "msg",
          role: "assistant",
          content: "Tudo bem, mantive os números como estavam.",
        },
      ]);
    }
  };

  const escalateUrl = React.useMemo(
    () => buildWhatsappUrl(page.module || "Visão geral", moduleSummary),
    [page.module, moduleSummary],
  );

  return (
    <div className="print:hidden">
      <motion.button
        aria-label="Abrir suporte executivo"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 h-12 w-12 rounded-full bg-foreground text-background shadow-2xl grid place-items-center"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            />
            <motion.aside
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[400px] max-w-[420px] h-[min(80vh,640px)] glass-strong rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="px-4 py-3 flex items-center justify-between border-b border-border/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Logo size={32} />
                  <div className="leading-tight min-w-0">
                    <div className="text-sm font-semibold truncate">
                      Suporte executivo
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      Lendo módulo: {page.module}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1 px-4 py-4">
                <div className="space-y-3">
                  {items.map((it, i) =>
                    it.kind === "msg" ? (
                      <ChatBubble key={i} item={it} escalateUrl={escalateUrl} />
                    ) : (
                      <ImportConfirmCard
                        key={i}
                        item={it}
                        onDecide={(d) => decide(i, d)}
                      />
                    ),
                  )}
                  {status !== "idle" && <TypingIndicator status={status} />}
                  <div ref={endRef} />
                </div>
              </ScrollArea>

              <div className="border-t border-border/60 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onPickFile}
                    disabled={status !== "idle"}
                    aria-label="Anexar arquivo"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Pergunte qualquer coisa…"
                    disabled={status !== "idle"}
                  />
                  <Button
                    onClick={() => send()}
                    disabled={status !== "idle" || !input.trim()}
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                <a
                  href={escalateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl glass px-3 h-9 text-[12px] text-foreground hover:bg-white/80 dark:hover:bg-white/[0.08] transition-colors"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Suporte especializado · WhatsApp
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>

                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,application/pdf,image/*,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => onFileSelected(e.target.files?.[0] ?? undefined)}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChatBubble({
  item,
  escalateUrl,
}: {
  item: Extract<ChatItem, { kind: "msg" }>;
  escalateUrl: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-col gap-1.5 max-w-[85%]", item.role === "user" ? "ml-auto items-end" : "mr-auto items-start")}
    >
      <div
        className={cn(
          "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          item.role === "user"
            ? "bg-foreground text-background rounded-br-md"
            : "bg-foreground/[0.05] dark:bg-white/[0.06] rounded-bl-md",
        )}
      >
        {item.content}
      </div>
      {item.actionsApplied && item.actionsApplied.length > 0 && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-300 max-w-full">
          <div className="flex items-center gap-1.5 mb-1 font-medium">
            <Sparkles className="h-3 w-3" />
            Aplicado no painel
          </div>
          <ul className="space-y-0.5 list-disc pl-4">
            {item.actionsApplied.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {item.escalate && item.role === "assistant" && (
        <a
          href={escalateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] px-2.5 py-1 transition-colors"
        >
          Falar com suporte humano
          <ArrowRight className="h-3 w-3" />
        </a>
      )}
    </motion.div>
  );
}

function ImportConfirmCard({
  item,
  onDecide,
}: {
  item: Extract<ChatItem, { kind: "import-confirm" }>;
  onDecide: (d: "accepted" | "rejected") => void;
}) {
  const cardSummary = React.useMemo(() => {
    const cards = item.payload?.cards ?? {};
    const entries = Object.entries(cards) as Array<[string, number]>;
    return entries.slice(0, 4);
  }, [item.payload]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mr-auto max-w-[90%] rounded-2xl rounded-bl-md border border-emerald-500/25 bg-emerald-500/[0.06] px-3.5 py-3 text-sm space-y-2.5"
    >
      <div className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Pré-visualização do arquivo · {item.filename}
      </div>
      {cardSummary.length > 0 && (
        <ul className="space-y-1 text-[12px]">
          {cardSummary.map(([k, v]) => (
            <li key={k} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground capitalize">{k}</span>
              <span className="font-medium tabular-nums">
                {typeof v === "number" ? formatCurrencyBRL(v) : String(v)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2 pt-1">
        {item.decided === "accepted" ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[12px]">
            <Check className="h-3.5 w-3.5" /> Aplicado ao painel
          </span>
        ) : item.decided === "rejected" ? (
          <span className="text-muted-foreground text-[12px]">Mantido o painel atual</span>
        ) : (
          <>
            <Button size="sm" className="h-8" onClick={() => onDecide("accepted")}>
              Atualizar painel
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => onDecide("rejected")}
            >
              Não, obrigado
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
}

function TypingIndicator({ status }: { status: Status }) {
  return (
    <div className="mr-auto bg-foreground/[0.05] dark:bg-white/[0.06] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-xs text-muted-foreground inline-flex items-center gap-2">
      {status === "uploading" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Lendo o documento…
        </>
      ) : (
        <>
          <Dot />
          <Dot delay={0.15} />
          <Dot delay={0.3} />
        </>
      )}
    </div>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <motion.span
      animate={{ opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
      transition={{ duration: 1, repeat: Infinity, delay }}
      className="inline-block h-1.5 w-1.5 rounded-full bg-foreground/60"
    />
  );
}

function detectFrustration(text: string) {
  const t = text.toLowerCase();
  return FRUSTRATION_KEYWORDS.some((k) => t.includes(k));
}

function buildWhatsappUrl(module: string, summary: string) {
  const message = `Olá, Letícia. O sistema identificou uma dúvida complexa no módulo ${module}. Dados atuais: ${summary || "sem indicadores carregados"}. Preciso de suporte humano.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// ---------------------------------------------------------------------------
// Ações estruturadas
// ---------------------------------------------------------------------------

function extractActions(reply: string): { display: string; actions: AssistantAction[] } {
  const fenceRegex = /```actions\s*([\s\S]*?)```/i;
  const match = reply.match(fenceRegex);
  if (!match) return { display: reply, actions: [] };
  const display = reply.replace(fenceRegex, "").trim();
  try {
    const parsed = JSON.parse(match[1]);
    const actions: unknown[] = Array.isArray(parsed?.actions) ? parsed.actions : [];
    const safe = actions.filter((a): a is AssistantAction => isValidAction(a));
    return { display, actions: safe };
  } catch {
    return { display, actions: [] };
  }
}

function isValidAction(a: any): a is AssistantAction {
  if (!a || typeof a !== "object" || typeof a.type !== "string") return false;
  switch (a.type) {
    case "update_card":
      return ["receita", "despesa", "lucro", "ticket"].includes(a.key) && Number.isFinite(Number(a.value));
    case "patch_edicao":
      return typeof a.slug === "string" && a.patch && typeof a.patch === "object";
    case "patch_lote":
      return typeof a.slug === "string" && Number.isInteger(Number(a.loteIndex)) && a.patch && typeof a.patch === "object";
    case "add_lancamento":
      return (
        ["receita", "despesa"].includes(a.tipo) &&
        typeof a.descricao === "string" &&
        typeof a.categoria === "string" &&
        Number.isFinite(Number(a.valor)) &&
        typeof a.vencimento === "string"
      );
    case "toggle_pago":
      return typeof a.id === "string" && typeof a.pago === "boolean";
    case "remove_lancamento":
      return typeof a.id === "string";
    default:
      return false;
  }
}

function applyActions(
  actions: AssistantAction[],
  dashboard: ReturnType<typeof useDashboardContext>,
  appState: ReturnType<typeof useAppState>,
): string[] {
  const summary: string[] = [];
  for (const a of actions) {
    try {
      switch (a.type) {
        case "update_card": {
          dashboard.setCardValue(a.key, Number(a.value));
          dashboard.triggerGlow("emerald");
          summary.push(`Indicador "${a.key}" atualizado para ${formatCurrencyBRL(Number(a.value))}`);
          break;
        }
        case "patch_edicao": {
          appState.patchEdicao(a.slug, sanitizeEdicaoPatch(a.patch));
          summary.push(`Edição "${a.slug}" atualizada`);
          break;
        }
        case "patch_lote": {
          appState.patchLote(a.slug, a.loteIndex, sanitizeLotePatch(a.patch));
          summary.push(`Lote ${a.loteIndex + 1} de "${a.slug}" atualizado`);
          break;
        }
        case "add_lancamento": {
          const lanc: Omit<FinanceLancamento, "id"> = {
            tipo: a.tipo,
            descricao: a.descricao,
            categoria: (a.categoria as FinanceCategoria) ?? "Outros",
            valor: Math.max(0, Math.round(Number(a.valor))),
            vencimento: a.vencimento,
            pagamento: a.pagamento ?? null,
            edicaoSlug: a.edicaoSlug ?? null,
          };
          appState.addLancamento(lanc);
          summary.push(`${a.tipo === "receita" ? "Recebimento" : "Pagamento"} "${a.descricao}" lançado (${formatCurrencyBRL(lanc.valor)})`);
          break;
        }
        case "toggle_pago": {
          appState.togglePago(a.id, a.pago);
          summary.push(`Lançamento ${a.pago ? "marcado como liquidado" : "reaberto"}`);
          break;
        }
        case "remove_lancamento": {
          appState.removeLancamento(a.id);
          summary.push("Lançamento removido");
          break;
        }
      }
    } catch {
      summary.push("Uma ação não pôde ser aplicada e foi ignorada.");
    }
  }
  return summary;
}

function sanitizeEdicaoPatch(patch: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (typeof patch.nome === "string") out.nome = patch.nome;
  if (typeof patch.cidade === "string") out.cidade = patch.cidade;
  if (typeof patch.data === "string") out.data = patch.data;
  if (Number.isFinite(Number(patch.capacidade))) out.capacidade = Math.round(Number(patch.capacidade));
  if (Number.isFinite(Number(patch.patrocinio))) out.patrocinio = Math.round(Number(patch.patrocinio));
  if (Number.isFinite(Number(patch.custoProducao))) out.custoProducao = Math.round(Number(patch.custoProducao));
  return out;
}

function sanitizeLotePatch(patch: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (typeof patch.nome === "string") out.nome = patch.nome;
  if (Number.isFinite(Number(patch.preco))) out.preco = Number(patch.preco);
  if (Number.isFinite(Number(patch.vendidos))) out.vendidos = Math.max(0, Math.round(Number(patch.vendidos)));
  if (Number.isFinite(Number(patch.estoque))) out.estoque = Math.max(0, Math.round(Number(patch.estoque)));
  return out;
}
