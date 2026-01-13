import Link from "next/link";

import { auth } from "@/auth";

export default async function Sidebar() {
  const session = await auth();

  return (
    <aside className="flex h-dvh w-[80px] flex-col items-center bg-zinc-900 text-zinc-100">
      <div className="flex w-full flex-col items-center pt-6">
        <button
          type="button"
          aria-label="Menu"
          title="Menu"
          className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-zinc-200 ring-1 ring-transparent transition hover:bg-white/5 hover:text-zinc-50 hover:ring-white/10"
        >
          <span aria-hidden className="text-2xl leading-none">
            ≡
          </span>
        </button>

        {session ? (
          <Link
            href="/classes/new"
            aria-label="Add class"
            title="Create class"
            className="group mt-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/20 shadow-[0_0_0_1px_rgba(34,211,238,0.12)] transition hover:bg-cyan-300/15 hover:text-cyan-100"
          >
            <span aria-hidden className="text-2xl leading-none">
              +
            </span>
          </Link>
        ) : (
          <Link
            href="/signin"
            aria-label="Sign in to create a class"
            title="Sign in"
            className="group mt-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/20 shadow-[0_0_0_1px_rgba(34,211,238,0.12)] transition hover:bg-cyan-300/15 hover:text-cyan-100"
          >
            <span aria-hidden className="text-2xl leading-none">
              +
            </span>
          </Link>
        )}
      </div>

      <div className="flex w-full flex-1" />

      <div className="flex w-full flex-col items-center pb-6">
      </div>
    </aside>
  );
}
