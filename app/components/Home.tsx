import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import HomeChat from "@/app/components/HomeChat";

export default async function Home() {
  const session = await auth();
  const classes = session?.user?.id
    ? await prisma.class.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true },
      })
    : [];

  const href = session ? "/classes/new" : "/signin?callbackUrl=%2Fclasses%2Fnew";

  if (session?.user?.id && classes.length > 0) {
    return <HomeChat classes={classes} />;
  }

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[color:var(--app-bg)] text-[color:var(--app-text)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[color:var(--app-bg)] via-[color:var(--app-bg)] to-[color:var(--app-bg)]" />

        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--app-border) 1px, transparent 1px), linear-gradient(to bottom, var(--app-border) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            backgroundPosition: "center",
            maskImage:
              "radial-gradient(ellipse at top, black 35%, transparent 70%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at top, black 35%, transparent 70%)",
          }}
        />

        <div className="absolute left-1/2 top-24 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[color:var(--app-elevated)] blur-3xl" />
        <div className="absolute left-1/2 top-32 h-[380px] w-[760px] -translate-x-1/2 rounded-full bg-[color:var(--app-surface)] blur-3xl" />

        <div className="absolute -right-48 top-24 h-[460px] w-[460px] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -left-64 bottom-12 h-[520px] w-[520px] rounded-full bg-indigo-400/10 blur-3xl" />
      </div>

      <main className="relative mx-auto grid min-h-[calc(100vh-64px)] max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:gap-10 md:py-28">
        <section className="text-center md:text-left">
          <h1 className="text-balance text-5xl font-normal tracking-tight text-[color:var(--app-text)] sm:text-6xl">
            Stop juggling classes.
            <span className="text-cyan-300"> Start managing them</span>.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-[color:var(--app-subtle)] md:max-w-none">
            Syllab.ai makes managing school simple. Track your classes, organize assignments, and plan your week in seconds.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row md:items-start">
            <Link
              href={href}
              className="group inline-flex w-full items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_14px_40px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200 sm:w-auto"
            >
              Upload your first syllabus
              <span className="ml-2 transition-transform group-hover:translate-x-0.5">→</span>
            </Link>

          </div>

          <div className="mt-10 inline-flex items-center gap-2 rounded-full bg-[color:var(--app-panel)] px-3 py-1 text-xs text-[color:var(--app-subtle)] ring-1 ring-[color:var(--app-border)]">
            <span className="text-[color:var(--app-text)]">ℹ</span>
            Syllab.ai can make mistakes double-check important details.
          </div>
        </section>

        <section className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[28px] bg-gradient-to-br from-cyan-400/15 via-indigo-400/10 to-transparent blur-2xl" />

          <div className="group relative mx-auto w-full max-w-md rounded-3xl bg-[color:var(--app-surface)] p-5 ring-1 ring-[color:var(--app-border)] backdrop-blur-xl transition will-change-transform md:ml-auto">
            <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-b from-[color:var(--app-elevated)] to-transparent opacity-60" />

            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[color:var(--app-text)]">BIO 201 — Spring</div>
              <div className="rounded-full bg-[color:var(--app-chip)] px-2 py-1 text-[11px] font-medium text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)]">
                AI plan
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl bg-[color:var(--app-panel)] p-4 ring-1 ring-[color:var(--app-border)]">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-[color:var(--app-text)]">Syllabus.pdf</div>
                  <div className="text-[11px] text-[color:var(--app-subtle)]">12 pages</div>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[color:var(--app-border)]">
                  <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-cyan-300 to-indigo-300" />
                </div>
                <div className="mt-2 text-[11px] text-[color:var(--app-subtle)]">Extracted: grading, deadlines, office hours</div>
              </div>

              <div className="rounded-2xl bg-[color:var(--app-panel)] p-4 ring-1 ring-[color:var(--app-border)]">
                <div className="text-xs font-medium text-[color:var(--app-text)]">Upcoming</div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-[color:var(--app-surface)] px-3 py-2">
                    <div className="text-[12px] text-[color:var(--app-text)]">Reading: Ch. 3</div>
                    <div className="text-[11px] text-[color:var(--app-subtle)]">Fri</div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-[color:var(--app-surface)] px-3 py-2">
                    <div className="text-[12px] text-[color:var(--app-text)]">Quiz 1</div>
                    <div className="text-[11px] text-[color:var(--app-subtle)]">Mon</div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-[color:var(--app-surface)] px-3 py-2">
                    <div className="text-[12px] text-[color:var(--app-text)]">Lab report</div>
                    <div className="text-[11px] text-[color:var(--app-subtle)]">Next Wed</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-[color:var(--app-panel)] p-4 ring-1 ring-[color:var(--app-border)]">
                <div className="text-xs font-medium text-[color:var(--app-text)]">This week</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-[color:var(--app-surface)] px-3 py-2">
                    <div className="text-[11px] text-[color:var(--app-subtle)]">Mon</div>
                    <div className="text-[12px] text-[color:var(--app-text)]">Lecture + notes</div>
                  </div>
                  <div className="rounded-xl bg-[color:var(--app-surface)] px-3 py-2">
                    <div className="text-[11px] text-[color:var(--app-subtle)]">Tue</div>
                    <div className="text-[12px] text-[color:var(--app-text)]">Start quiz prep</div>
                  </div>
                  <div className="rounded-xl bg-[color:var(--app-surface)] px-3 py-2">
                    <div className="text-[11px] text-[color:var(--app-subtle)]">Thu</div>
                    <div className="text-[12px] text-[color:var(--app-text)]">Draft lab report</div>
                  </div>
                  <div className="rounded-xl bg-[color:var(--app-surface)] px-3 py-2">
                    <div className="text-[11px] text-[color:var(--app-subtle)]">Sun</div>
                    <div className="text-[12px] text-[color:var(--app-text)]">Weekly review</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute -right-6 -top-8 hidden rotate-6 rounded-2xl bg-[color:var(--app-surface)] p-4 ring-1 ring-[color:var(--app-border)] backdrop-blur-xl md:block">
              <div className="text-xs font-medium text-[color:var(--app-text)]">Notes</div>
              <div className="mt-2 h-2 w-44 rounded-full bg-[color:var(--app-border)]" />
              <div className="mt-2 h-2 w-36 rounded-full bg-[color:var(--app-border)]" />
              <div className="mt-2 h-2 w-40 rounded-full bg-[color:var(--app-border)]" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
