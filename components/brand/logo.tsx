import * as React from "react";
import { cn } from "@/lib/utils";

type LogoProps = React.SVGProps<SVGSVGElement> & {
  size?: number;
  withGlow?: boolean;
};

/**
 * Monograma "L" abstrato em forma de joia geométrica.
 * Combina gradientes em camadas, faceta diamante interna e
 * highlight de vidro para sugerir uma identidade premium.
 */
export function Logo({ size = 32, withGlow = false, className, ...props }: LogoProps) {
  const id = React.useId().replace(/:/g, "");
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center",
        withGlow && "drop-shadow-[0_8px_20px_hsl(var(--brand-2)/0.35)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 40 40"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <defs>
          <linearGradient id={`g1-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--brand-3))" />
            <stop offset="55%" stopColor="hsl(var(--brand-1))" />
            <stop offset="100%" stopColor="hsl(var(--brand-2))" />
          </linearGradient>
          <linearGradient id={`g2-${id}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--brand-2))" stopOpacity="0.85" />
            <stop offset="100%" stopColor="hsl(var(--brand-1))" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={`gloss-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.55" />
            <stop offset="60%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`spec-${id}`} cx="0.3" cy="0.2" r="0.6">
            <stop offset="0%" stopColor="white" stopOpacity="0.6" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Tablete arredondado de fundo (corpo da joia) */}
        <rect
          x="2.5"
          y="2.5"
          width="35"
          height="35"
          rx="10"
          fill={`url(#g1-${id})`}
        />
        {/* Camada de profundidade interna */}
        <rect
          x="2.5"
          y="2.5"
          width="35"
          height="35"
          rx="10"
          fill={`url(#g2-${id})`}
          opacity="0.55"
        />

        {/* Faceta diamante (acento high-tech) */}
        <path
          d="M20 7 L29.5 16 L20 25 L10.5 16 Z"
          fill="white"
          opacity="0.10"
        />
        <path
          d="M20 7 L29.5 16 L20 16 Z"
          fill="white"
          opacity="0.18"
        />

        {/* Monograma L geométrico */}
        <path
          d="M14 13 L14 27 L26 27"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.95"
        />
        {/* Pingente / coroa minúscula no topo */}
        <path
          d="M26 13 L28 11 L30 13 L28 15 Z"
          fill="white"
          opacity="0.95"
        />

        {/* Highlight de vidro (gloss superior) */}
        <rect
          x="2.5"
          y="2.5"
          width="35"
          height="18"
          rx="10"
          fill={`url(#gloss-${id})`}
          opacity="0.55"
        />
        {/* Especular sutil */}
        <ellipse cx="14" cy="11" rx="8" ry="3.5" fill={`url(#spec-${id})`} />

        {/* Borda fina para efeito de vidro */}
        <rect
          x="3"
          y="3"
          width="34"
          height="34"
          rx="9.5"
          fill="none"
          stroke="white"
          strokeOpacity="0.35"
          strokeWidth="0.6"
        />
      </svg>
    </span>
  );
}

/** Logo + wordmark */
export function LogoLockup({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo size={size} />
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight">Portal executivo</div>
        <div className="text-[10px] text-muted-foreground -mt-0.5">
          Visão consolidada
        </div>
      </div>
    </div>
  );
}
