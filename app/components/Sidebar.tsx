import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function getInitials(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase());
  return initials.join("") || "?";
}

export default async function Sidebar() {
  const session = await auth();
  const classes = session?.user?.id
    ? await prisma.class.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true },
      })
    : [];

  return (
    <aside className="flex h-dvh w-[80px] flex-col items-center bg-zinc-900 text-zinc-100">
      <div className="flex w-full flex-col items-center pt-6">
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

        {classes.length ? (
          <div className="mt-4 flex w-full flex-col items-center gap-2">
            {classes.map((course) => (
              <Link
                key={course.id}
                href={`/classes/${course.id}`}
                title={course.title}
                aria-label={`Open ${course.title}`}
                className="group relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-xs font-semibold text-zinc-100 ring-1 ring-white/10 transition hover:bg-white/10"
              >
                <span className="text-[11px] tracking-wide">
                  {getInitials(course.title)}
                </span>
                <span className="absolute -right-1 top-1 h-2 w-2 rounded-full bg-cyan-300/80 opacity-0 transition group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex w-full flex-1" />

      <div className="flex w-full flex-col items-center pb-6">
      </div>
    </aside>
  );
}
