"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useDashboardContext } from "@/components/dashboard/dashboard-context";
import { Logo } from "@/components/brand/logo";

type Msg = { role: "user" | "assistant"; content: string };

export function SupportFab() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Olá, Ludymilla. Estou acompanhando seus números em tempo real. Pode me perguntar sobre receitas, margens, eventos ou cenários.",
    },
  ]);
  const ctx = useDashboardContext();
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          context: {
            indicators: ctx.cards,
            series: ctx.series,
          },
        }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply ?? "Não consegui responder agora." },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Falha temporária na sincronização. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.button
        aria-label="Abrir suporte executivo"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-foreground text-background shadow-2xl grid place-items-center"
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
              className="fixed bottom-6 right-6 z-50 w-[min(92vw,400px)] h-[min(80vh,640px)] glass-strong rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="px-4 py-3 flex items-center justify-between border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <Logo size={32} />
                  <div className="leading-tight">
                    <div className="text-sm font-semibold">Suporte executivo</div>
                    <div className="text-[11px] text-muted-foreground">
                      Conselheiro de negócios
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1 px-4 py-4">
                <div className="space-y-3">
                  {messages.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        m.role === "user"
                          ? "ml-auto bg-foreground text-background rounded-br-md"
                          : "mr-auto bg-foreground/[0.05] dark:bg-white/[0.06] rounded-bl-md",
                      )}
                    >
                      {m.content}
                    </motion.div>
                  ))}
                  {loading && (
                    <div className="mr-auto bg-foreground/[0.05] dark:bg-white/[0.06] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm">
                      <span className="inline-flex gap-1 items-center text-muted-foreground">
                        <Dot />
                        <Dot delay={0.15} />
                        <Dot delay={0.3} />
                      </span>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>
              </ScrollArea>

              <div className="border-t border-border/60 p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Pergunte sobre seus números…"
                    disabled={loading}
                  />
                  <Button onClick={send} disabled={loading || !input.trim()} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
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
