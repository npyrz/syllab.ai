"use client";

import { useEffect, useState } from "react";
import { updateUserThemeAction } from "@/app/actions/user";

type ThemeMode = "light" | "dark";

function getStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem("theme");
  return stored === "light" || stored === "dark" ? stored : null;
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem("theme", theme);
}

type ThemeToggleProps = {
  initialTheme: ThemeMode | null;
};

function resolveInitialTheme(initialTheme: ThemeMode | null): ThemeMode {
  if (initialTheme) return initialTheme;

  if (typeof window === "undefined") return "dark";

  const stored = getStoredTheme();
  if (stored) return stored;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle({ initialTheme }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>(() => resolveInitialTheme(initialTheme));
  const effectiveTheme = initialTheme ?? theme;

  useEffect(() => {
    applyTheme(effectiveTheme);
  }, [effectiveTheme]);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = effectiveTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    void updateUserThemeAction(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-full border border-transparent bg-[color:var(--app-chip)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] transition hover:bg-[color:var(--app-elevated)]"
      aria-label={`Switch to ${effectiveTheme === "dark" ? "light" : "dark"} mode`}
    >
      <span className="h-2 w-2 rounded-full bg-cyan-300" />
      {effectiveTheme === "dark" ? "Dark" : "Light"}
    </button>
  );
}
