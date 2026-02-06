"use client";

import { useState } from "react";

const activeButtonClass =
  "inline-flex items-center gap-2 rounded-full bg-cyan-300/15 px-3 py-2 text-xs font-medium text-cyan-100 ring-1 ring-cyan-300/30 transition";
const idleButtonClass =
  "inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-xs font-medium text-zinc-100 ring-1 ring-white/10 transition hover:bg-white/10";

type ClassOption = {
  id: string;
  title: string;
};

function getInitials(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase());
  return initials.join("") || "?";
}

export default function HomeChat({ classes }: { classes: ClassOption[] }) {
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id ?? ""
  );

  const selectedClass = classes.find((course) => course.id === selectedClassId);

  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-black">
      <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-5xl flex-col px-6 py-12">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-balance text-3xl font-normal tracking-tight text-zinc-50 sm:text-4xl">
            Ask about your classes
          </h1>
          <p className="mt-3 max-w-xl text-sm text-zinc-400">
            Pick a class and ask a question to get summaries, deadlines, and key details.
          </p>
        </div>

        <div className="mt-10 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex flex-wrap items-center gap-2">
            {classes.map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => setSelectedClassId(course.id)}
                className={
                  course.id === selectedClassId ? activeButtonClass : idleButtonClass
                }
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-300/10 text-[11px] font-semibold text-cyan-200">
                  {getInitials(course.title)}
                </span>
                {course.title}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-black/40 px-4 py-3 ring-1 ring-white/10">
            <input
              type="text"
              placeholder={
                selectedClass
                  ? `Ask about ${selectedClass.title}...`
                  : "Ask something about your classes..."
              }
              className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            />
            <button
              type="button"
              className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-black transition hover:bg-cyan-200"
            >
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
