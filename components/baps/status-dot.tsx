import { cn } from "@/lib/utils";

export type StatusDotVariant = "success" | "warning" | "critical";

const ring: Record<StatusDotVariant, string> = {
  success: "bg-emerald-500/35 shadow-[0_0_0_1px_rgba(16,185,129,0.45)]",
  warning: "bg-amber-400/35 shadow-[0_0_0_1px_rgba(251,191,36,0.5)]",
  critical: "bg-red-500/40 shadow-[0_0_0_1px_rgba(239,68,68,0.55)]",
};

const core: Record<StatusDotVariant, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-400",
  critical: "bg-red-500",
};

export function StatusDot({
  status,
  className,
  "aria-label": ariaLabel,
}: {
  status: StatusDotVariant;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <span
      className={cn("relative inline-flex h-3 w-3 shrink-0 items-center justify-center", className)}
      aria-label={ariaLabel ?? `Status ${status}`}
      role="img"
    >
      <span
        className={cn(
          "absolute h-[14px] w-[14px] rounded-full animate-pulse motion-reduce:animate-none",
          ring[status],
        )}
      />
      <span className={cn("relative h-3 w-3 rounded-full shadow-inner", core[status])} />
    </span>
  );
}
