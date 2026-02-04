"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { signOutAction } from "@/app/actions/auth";

type ProfileMenuProps = {
  user?: {
    name?: string | null;
    email?: string | null;
  };
};

function getInitials(nameOrEmail?: string | null) {
  const value = (nameOrEmail ?? "").trim();
  if (!value) return "?";

  if (value.includes("@")) return value.slice(0, 1).toUpperCase();

  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();

  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

export default function ProfileMenu({ user }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const title = useMemo(() => user?.name ?? user?.email ?? "Account", [user]);
  const subtitle = useMemo(
    () => (user?.name && user?.email ? user.email : undefined),
    [user]
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/10 transition hover:ring-white/20"
        title={title}
      >
        <span className="text-sm font-semibold text-zinc-200">
          {getInitials(user?.name ?? user?.email)}
        </span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />

          <aside
            id={panelId}
            role="dialog"
            aria-label="Profile menu"
            className="fixed right-4 top-20 z-50 w-[320px] rounded-3xl bg-white/6 p-5 ring-1 ring-white/10 backdrop-blur-xl"
          >
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full bg-black/30 ring-1 ring-white/10">
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-200">
                  {getInitials(user?.name ?? user?.email)}
                </div>
              </div>

              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-50">
                  {title}
                </div>
                {subtitle ? (
                  <div className="truncate text-xs text-zinc-400">{subtitle}</div>
                ) : null}
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="text-xs font-medium text-zinc-200">Profile</div>
              <div className="mt-2 text-xs text-zinc-400">
                Signed in{user?.email ? ` as ${user.email}` : "."}
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="text-xs font-medium text-zinc-200">Settings</div>
              <form action={signOutAction} className="mt-3">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_10px_30px_rgba(34,211,238,0.16)] transition hover:bg-cyan-200"
                >
                  Sign out
                </button>
              </form>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
