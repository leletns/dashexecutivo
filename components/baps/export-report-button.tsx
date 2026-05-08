"use client";

import * as React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ExportReportButton({ className }: { className?: string }) {
  const print = () => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => window.print());
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={print}
      aria-label="Exportar PDF para impressão"
      className={cn(
        "gap-2 rounded-xl border-border/80 bg-background/60 backdrop-blur-sm shadow-sm print:hidden px-2 sm:px-3",
        className,
      )}
    >
      <Printer className="h-3.5 w-3.5 opacity-80 shrink-0" />
      <span className="hidden sm:inline">Exportar PDF</span>
    </Button>
  );
}
