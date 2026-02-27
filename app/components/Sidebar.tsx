import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type SidebarClass = {
  id: string;
  title: string;
};

function getInitials(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase());
  return initials.join("") || "?";
}

export default async function Sidebar() {
  const session = await auth();
  const classes: SidebarClass[] = session?.user?.id
    ? await prisma.class.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true },
      })
    : [];

  return (
    <aside className="hidden min-h-dvh w-[80px] flex-col items-center bg-[color:var(--app-sidebar)] text-[color:var(--app-text)] md:flex">
      <div className="flex w-full flex-col items-center pt-6">
        {session ? (
          <Link
            href="/classes/new"
            aria-label="Add class"
            title="Create class"
            className="group mt-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--app-elevated)] text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] transition hover:bg-[color:var(--app-surface)]"
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
            className="group mt-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--app-elevated)] text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] transition hover:bg-[color:var(--app-surface)]"
          >
            <span aria-hidden className="text-2xl leading-none">
              +
            </span>
          </Link>
        )}

        {classes.length ? (
          <div className="mt-4 flex w-full flex-col items-center gap-2">
            {classes.map((course: SidebarClass) => (
              <Link
                key={course.id}
                href={`/classes/${course.id}`}
                title={course.title}
                aria-label={`Open ${course.title}`}
                className="group relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--app-surface)] text-xs font-semibold text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] transition hover:bg-[color:var(--app-elevated)]"
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

      <div className="mt-auto w-full pb-6" />
    </aside>
  );
}
