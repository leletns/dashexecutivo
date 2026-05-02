"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, LogOut, Pencil } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CalculatorPopover } from "@/components/layout/calculator-popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useProfile, getInitials } from "@/lib/profile";
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

  const logout = () => router.push("/");

  return (
    <header className="sticky top-0 z-30 px-4 pt-4">
      <div className="glass rounded-2xl px-3 sm:px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Popover>
            <PopoverTrigger asChild>
              <button
                aria-label="Trocar foto"
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
            <PopoverContent align="start" className="w-60 p-1.5">
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
              <div className="h-px bg-border my-1" />
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
                    className="h-7 px-2 py-0 text-sm font-semibold w-44"
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
                  className="group/name inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
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

        <div className="flex items-center gap-2">
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

