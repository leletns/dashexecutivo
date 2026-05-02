"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Paperclip, Trash2, UploadCloud } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useDashboardContext,
  type IndicatorKey,
} from "@/components/dashboard/dashboard-context";
import { cn } from "@/lib/utils";

export function AttachmentDialog({
  open,
  onOpenChange,
  cardKey,
  cardLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cardKey: IndicatorKey;
  cardLabel: string;
}) {
  const { attachments, addAttachments, removeAttachment } = useDashboardContext();
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const list = attachments[cardKey];

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    addAttachments(cardKey, Array.from(files));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Comprovantes
          </DialogTitle>
          <DialogDescription>
            Anexos vinculados a <span className="font-medium text-foreground">{cardLabel}</span>.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "rounded-xl border border-dashed p-5 text-center cursor-pointer transition-colors",
            drag
              ? "border-foreground/40 bg-foreground/[0.04]"
              : "border-border hover:border-foreground/30",
          )}
        >
          <UploadCloud className="h-5 w-5 mx-auto text-muted-foreground" />
          <div className="mt-2 text-sm">
            Arraste arquivos ou <span className="underline underline-offset-4">clique para anexar</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            PDF, imagem ou planilha
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        <div className="mt-1 max-h-56 overflow-y-auto pr-1 -mr-1 space-y-1.5">
          <AnimatePresence initial={false}>
            {list.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-muted-foreground text-center py-3"
              >
                Nenhum comprovante anexado
              </motion.div>
            )}
            {list.map((a) => (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center justify-between rounded-lg bg-foreground/[0.03] dark:bg-white/[0.03] px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{a.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {(a.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => removeAttachment(cardKey, a.name)}
                  aria-label="Remover anexo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Concluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
