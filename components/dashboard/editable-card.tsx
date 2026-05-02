"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Paperclip, Pencil, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useDashboardContext,
  type IndicatorCard as IndicatorCardType,
} from "@/components/dashboard/dashboard-context";
import { AttachmentDialog } from "@/components/dashboard/attachment-dialog";
import { GlowWrapper } from "@/components/dashboard/glow-wrapper";
import { formatCurrencyBRL, formatNumberBR, parseLooseNumber, cn } from "@/lib/utils";

export function EditableCard({ card }: { card: IndicatorCardType }) {
  const { setCardValue } = useDashboardContext();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [attachOpen, setAttachOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const formatted =
    card.format === "currency" ? formatCurrencyBRL(card.value) : formatNumberBR(card.value);

  const beginEdit = () => {
    setDraft(String(card.value).replace(".", ","));
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const commit = () => {
    const next = parseLooseNumber(draft);
    setCardValue(card.key, next);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  return (
    <GlowWrapper className="rounded-2xl">
      <Card className="p-5 group relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-start justify-between"
      >
        <div className="space-y-0.5">
          <div className="text-[12px] font-medium text-muted-foreground tracking-tight">
            {card.label}
          </div>
          {card.hint && (
            <div className="text-[11px] text-muted-foreground/70">{card.hint}</div>
          )}
        </div>
        <button
          onClick={() => setAttachOpen(true)}
          className={cn(
            "h-7 w-7 grid place-items-center rounded-lg transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] dark:hover:bg-white/[0.06]",
          )}
          aria-label="Anexar comprovante"
        >
          <Paperclip className="h-3.5 w-3.5" />
        </button>
      </motion.div>

      <div className="mt-4 min-h-[44px] flex items-end gap-2">
        {editing ? (
          <div className="flex items-center gap-2 w-full">
            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancel();
              }}
              onBlur={commit}
              inputMode="decimal"
              className="h-10 text-2xl font-semibold tracking-tight tabular-nums px-2"
            />
            <button
              onClick={commit}
              className="h-9 w-9 grid place-items-center rounded-lg bg-foreground text-background"
              aria-label="Salvar"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={beginEdit}
            className="group/value flex items-center gap-2 text-left"
            aria-label="Editar valor"
          >
            <motion.span
              key={card.value}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[26px] font-semibold tracking-tight tabular-nums leading-none"
            >
              {formatted}
            </motion.span>
            <span className="opacity-0 group-hover/value:opacity-100 transition-opacity text-muted-foreground">
              <Pencil className="h-3.5 w-3.5" />
            </span>
          </button>
        )}
      </div>

      <AttachmentDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        cardKey={card.key}
        cardLabel={card.label}
      />
      </Card>
    </GlowWrapper>
  );
}
