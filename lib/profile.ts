"use client";

import * as React from "react";

export type Profile = {
  name: string;
  role: string;
  avatarDataUrl: string | null;
};

const KEY = "portal.profile.v1";

const DEFAULT: Profile = {
  name: "Ludymilla",
  role: "CEO · Portal executivo",
  avatarDataUrl: null,
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
    setProfile(read());
    setHydrated(true);
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Profile>).detail;
      if (detail) setProfile(detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setProfile(read());
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
      return next;
    });
  }, []);

  return { profile, update, hydrated };
}

export function getInitials(name: string) {
  if (!name) return "··";
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? "");
  return (a + b).toUpperCase();
}
