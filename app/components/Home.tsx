export default function Home() {
  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-black">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-black" />

        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            backgroundPosition: "center",
            maskImage:
              "radial-gradient(ellipse at top, black 35%, transparent 70%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at top, black 35%, transparent 70%)",
          }}
        />

        <div className="absolute left-1/2 top-24 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-white/8 blur-3xl" />
        <div className="absolute left-1/2 top-32 h-[380px] w-[760px] -translate-x-1/2 rounded-full bg-white/6 blur-3xl" />

        <div className="absolute -right-48 top-24 h-[460px] w-[460px] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -left-64 bottom-12 h-[520px] w-[520px] rounded-full bg-indigo-400/10 blur-3xl" />
      </div>

      <main className="relative mx-auto grid min-h-[calc(100vh-64px)] max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:gap-10 md:py-28">
        <section className="text-center md:text-left">
          <h1 className="text-balance text-5xl font-normal tracking-tight text-zinc-50 sm:text-6xl">
            Stop juggling classes.
            <span className="text-cyan-300"> Start managing them</span>.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-zinc-400 md:max-w-none">
            Syllab.ai makes managing school simple. Track your classes, organize assignments, and plan your week in seconds.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row md:items-start">
            <a
              href="#"
              className="group inline-flex w-full items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_14px_40px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200 sm:w-auto"
            >
              Upload your first syllabus
              <span className="ml-2 transition-transform group-hover:translate-x-0.5">→</span>
            </a>

          </div>

          <div className="mt-10 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400 ring-1 ring-white/10">
            <span className="text-zinc-300">ℹ</span>
            Syllab.ai can make mistakes double-check important details.
          </div>
        </section>

        <section className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[28px] bg-gradient-to-br from-cyan-400/15 via-indigo-400/10 to-transparent blur-2xl" />

          <div className="group relative mx-auto w-full max-w-md rounded-3xl bg-white/6 p-5 ring-1 ring-white/10 backdrop-blur-xl transition will-change-transform md:ml-auto">
            <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-b from-white/8 to-transparent opacity-60" />

            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-50">BIO 201 — Spring</div>
              <div className="rounded-full bg-cyan-300/15 px-2 py-1 text-[11px] font-medium text-cyan-200 ring-1 ring-cyan-300/20">
                AI plan
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-zinc-200">Syllabus.pdf</div>
                  <div className="text-[11px] text-zinc-400">12 pages</div>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-cyan-300 to-indigo-300" />
                </div>
                <div className="mt-2 text-[11px] text-zinc-400">Extracted: grading, deadlines, office hours</div>
              </div>

              <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                <div className="text-xs font-medium text-zinc-200">Upcoming</div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                    <div className="text-[12px] text-zinc-200">Reading: Ch. 3</div>
                    <div className="text-[11px] text-zinc-400">Fri</div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                    <div className="text-[12px] text-zinc-200">Quiz 1</div>
                    <div className="text-[11px] text-zinc-400">Mon</div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                    <div className="text-[12px] text-zinc-200">Lab report</div>
                    <div className="text-[11px] text-zinc-400">Next Wed</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                <div className="text-xs font-medium text-zinc-200">This week</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <div className="text-[11px] text-zinc-400">Mon</div>
                    <div className="text-[12px] text-zinc-200">Lecture + notes</div>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <div className="text-[11px] text-zinc-400">Tue</div>
                    <div className="text-[12px] text-zinc-200">Start quiz prep</div>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <div className="text-[11px] text-zinc-400">Thu</div>
                    <div className="text-[12px] text-zinc-200">Draft lab report</div>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <div className="text-[11px] text-zinc-400">Sun</div>
                    <div className="text-[12px] text-zinc-200">Weekly review</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute -right-6 -top-8 hidden rotate-6 rounded-2xl bg-white/4 p-4 ring-1 ring-white/10 backdrop-blur-xl md:block">
              <div className="text-xs font-medium text-zinc-200">Notes</div>
              <div className="mt-2 h-2 w-44 rounded-full bg-white/10" />
              <div className="mt-2 h-2 w-36 rounded-full bg-white/10" />
              <div className="mt-2 h-2 w-40 rounded-full bg-white/10" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
