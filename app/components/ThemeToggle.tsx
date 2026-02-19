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

export default function ThemeToggle({ initialTheme }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme ?? "dark");

  useEffect(() => {
    if (initialTheme) {
      applyTheme(initialTheme);
      setTheme(initialTheme);
      return;
    }

    const stored = getStoredTheme();
    if (stored) {
      setTheme(stored);
      applyTheme(stored);
      return;
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme: ThemeMode = prefersDark ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, [initialTheme]);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    void updateUserThemeAction(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-full border border-transparent bg-[color:var(--app-chip)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] transition hover:bg-[color:var(--app-elevated)]"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <span className="h-2 w-2 rounded-full bg-cyan-300" />
      {theme === "dark" ? "Dark" : "Light"}
    </button>
  );
}
