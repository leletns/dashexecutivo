"use client";

import * as React from "react";

export type AccentTheme = "lilas" | "grafite";

export type Profile = {
  name: string;
  role: string;
  avatarDataUrl: string | null;
  accent: AccentTheme;
};

const KEY = "portal.profile.v1";

const DEFAULT: Profile = {
  name: "Portal BAPS",
  role: "",
  avatarDataUrl: null,
  accent: "lilas",
};

function read(): Profile {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

function write(p: Profile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new CustomEvent("portal:profile", { detail: p }));
}

export function useProfile() {
  const [profile, setProfile] = React.useState<Profile>(DEFAULT);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const initial = read();
    setProfile(initial);
    setHydrated(true);
    applyAccent(initial.accent);
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Profile>).detail;
      if (detail) {
        setProfile(detail);
        applyAccent(detail.accent);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        const next = read();
        setProfile(next);
        applyAccent(next.accent);
      }
    };
    window.addEventListener("portal:profile", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("portal:profile", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = React.useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      write(next);
      if (patch.accent) applyAccent(patch.accent);
      return next;
    });
  }, []);

  return { profile, update, hydrated };
}

function applyAccent(accent: AccentTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.accent = accent;
}

export function getInitials(name: string) {
  if (!name) return "··";
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? "");
  return (a + b).toUpperCase();
}
