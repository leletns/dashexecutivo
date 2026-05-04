"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  LogOut,
  Pencil,
  Palette,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CalculatorPopover } from "@/components/layout/calculator-popover";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useProfile, getInitials, type AccentTheme } from "@/lib/profile";
import { cn } from "@/lib/utils";

export function Header() {
  const { profile, update, hydrated } = useProfile();
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(profile.name);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const initials = getInitials(profile.name);

  React.useEffect(() => {
    if (hydrated) setDraft(profile.name);
  }, [profile.name, hydrated]);

  const beginEdit = () => {
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };
  const commit = () => {
    const name = draft.trim();
    if (name) update({ name });
    setEditing(false);
  };

  const onAvatarFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update({ avatarDataUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const setAccent = (accent: AccentTheme) => update({ accent });

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-30 px-3 sm:px-4 pt-3 sm:pt-4">
      <div className="glass rounded-2xl pl-2 pr-2 sm:pl-3 sm:pr-3 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <MobileSidebar />

          <Popover>
            <PopoverTrigger asChild>
              <button
                aria-label="Trocar foto e preferências"
                className="relative h-9 w-9 rounded-full overflow-hidden shrink-0 group"
              >
                {profile.avatarDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarDataUrl}
                    alt={profile.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid place-items-center h-full w-full bg-gradient-to-br from-[hsl(var(--brand-1))] to-[hsl(var(--brand-2))] text-white text-[11px] font-semibold">
                    {initials}
                  </span>
                )}
                <span className="absolute inset-0 bg-black/40 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-3.5 w-3.5 text-white" />
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-1.5">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-foreground/[0.05] dark:hover:bg-white/[0.05]"
              >
                <Camera className="h-3.5 w-3.5" />
                Trocar foto do perfil
              </button>
              {profile.avatarDataUrl && (
                <button
                  onClick={() => update({ avatarDataUrl: null })}
                  className="w-full text-left rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-foreground/[0.05] dark:hover:bg-white/[0.05]"
                >
                  Remover foto atual
                </button>
              )}

              <div className="h-px bg-border my-1.5" />

              <div className="px-2 pt-1 pb-1.5">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Palette className="h-3 w-3" />
                  Personalizar cores
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <AccentChoice
                    label="Lilás executivo"
                    accent="lilas"
                    active={profile.accent === "lilas"}
                    onClick={() => setAccent("lilas")}
                    swatch="linear-gradient(135deg,#c4b5fd 0%,#a78bfa 50%,#8b5cf6 100%)"
                  />
                  <AccentChoice
                    label="Modo grafite"
                    accent="grafite"
                    active={profile.accent === "grafite"}
                    onClick={() => setAccent("grafite")}
                    swatch="linear-gradient(135deg,#cbd5e1 0%,#64748b 60%,#334155 100%)"
                  />
                </div>
              </div>

              <div className="h-px bg-border my-1.5" />

              <button
                onClick={logout}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-rose-500 hover:bg-rose-500/[0.08]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </PopoverContent>
          </Popover>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onAvatarFile(e.target.files?.[0] ?? undefined)}
          />

          <div className="leading-tight min-w-0">
            <div className="text-sm font-semibold tracking-tight flex items-center gap-1.5">
              {editing ? (
                <div className="flex items-center gap-1">
                  <Input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit();
                      if (e.key === "Escape") setEditing(false);
                    }}
                    className="h-7 px-2 py-0 text-sm font-semibold w-36 sm:w-44"
                  />
                  <button
                    onClick={commit}
                    className="h-6 w-6 grid place-items-center rounded-md bg-foreground text-background"
                    aria-label="Salvar"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={beginEdit}
                  className="group/name inline-flex items-center gap-1.5 hover:text-foreground transition-colors max-w-[55vw] sm:max-w-none"
                  aria-label="Editar nome"
                >
                  <span className={cn("truncate", !hydrated && "opacity-0")}>
                    Olá, {profile.name}
                  </span>
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {profile.role}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <CalculatorPopover />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            aria-label="Sair"
            className="hidden sm:inline-flex"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function AccentChoice({
  label,
  accent,
  active,
  onClick,
  swatch,
}: {
  label: string;
  accent: AccentTheme;
  active: boolean;
  onClick: () => void;
  swatch: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      data-accent-choice={accent}
      onClick={onClick}
      className={cn(
        "rounded-lg p-2 text-left text-[11px] flex flex-col gap-1.5 border transition-colors",
        active
          ? "border-foreground/30 bg-foreground/[0.04]"
          : "border-border hover:border-foreground/20",
      )}
    >
      <span
        className="h-5 w-full rounded-md"
        style={{ backgroundImage: swatch }}
      />
      <span className="flex items-center justify-between">
        {label}
        {active && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
}
