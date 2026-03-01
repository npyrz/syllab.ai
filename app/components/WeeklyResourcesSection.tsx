"use client";

import { useMemo, useState } from "react";

type WeeklyResourceItem = {
  title: string;
  type: "Article" | "Video" | "Course Notes";
  source: string;
  url: string;
  summary: string;
};

type WeeklyResourcesPayload = {
  week: number;
  topicSource: "schedule" | "syllabus" | "combined";
  topicSummary: string;
  resources: WeeklyResourceItem[];
};

export default function WeeklyResourcesSection({
  classId,
  currentWeek,
}: {
  classId: string;
  currentWeek: number | null;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<WeeklyResourcesPayload | null>(null);
  const [showNoMaterialPopup, setShowNoMaterialPopup] = useState(false);

  const effectiveWeek = useMemo(() => currentWeek ?? 1, [currentWeek]);

  const generateWeeklyResources = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/resources/weekly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classId, targetWeek: effectiveWeek }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 422 || result?.code === "NO_WEEKLY_CONTENT") {
          setPayload(null);
          setShowNoMaterialPopup(true);
          return;
        }

        throw new Error(result?.error || "Failed to generate weekly resources");
      }

      setPayload(result as WeeklyResourcesPayload);
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : "Failed to generate weekly resources");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-[color:var(--app-text)]">
            Weekly Resources
          </h2>
          <button
            type="button"
            onClick={generateWeeklyResources}
            disabled={isLoading}
            className="rounded-full bg-cyan-300 px-3.5 py-2 text-xs font-semibold text-black shadow-[0_10px_30px_rgba(34,211,238,0.35)] transition hover:bg-cyan-200 disabled:opacity-50"
          >
            {isLoading ? "Generating..." : "Generate weekly resources"}
          </button>
        </div>

        {payload ? (
          <div className="mt-4 rounded-3xl bg-[color:var(--app-surface)] p-4 ring-1 ring-[color:var(--app-border)] shadow-[var(--app-shadow)]">
            <div className="text-xs font-medium text-[color:var(--app-subtle)]">
              Source: {payload.topicSource === "combined" ? "syllabus + schedule" : payload.topicSource} • Week {payload.week}
            </div>
            {payload.topicSummary ? (
              <div className="mt-2 text-xs text-[color:var(--app-text)]">
                <span className="font-semibold">Topic focus:</span> {payload.topicSummary}
              </div>
            ) : null}
            <div className="mt-3 space-y-3">
              {payload.resources.map((resource) => (
                <div
                  key={resource.url}
                  className="rounded-2xl bg-[color:var(--app-panel)] px-4 py-3 ring-1 ring-[color:var(--app-border)] shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-sm font-semibold text-[color:var(--app-text)] hover:underline"
                    >
                      {resource.title}
                    </a>
                    <span className="rounded-full bg-[color:var(--app-chip)] px-2.5 py-1 text-[10px] font-medium text-[color:var(--app-chip-text)] ring-1 ring-[color:var(--app-border)]">
                      {resource.type}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-[color:var(--app-subtle)]">{resource.source}</div>
                  <p className="mt-2 text-xs leading-5 text-[color:var(--app-text)]">{resource.summary}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-2xl bg-red-500/10 p-3 text-xs text-red-400 ring-1 ring-red-500/20">
            {error}
          </div>
        ) : null}
      </section>

      {showNoMaterialPopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-[color:var(--app-surface)] p-6 text-sm text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
            <div className="text-base font-semibold text-[color:var(--app-text)]">
              Weekly content not found
            </div>
            <div className="mt-2 text-xs text-[color:var(--app-subtle)]">
              No material found. Please upload material with weekly content.
            </div>
            <div className="mt-5 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowNoMaterialPopup(false)}
                className="rounded-full bg-[color:var(--app-panel)] px-3.5 py-2 text-xs font-medium text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] transition hover:bg-[color:var(--app-elevated)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
