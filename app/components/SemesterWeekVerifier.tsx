"use client";

import { useState } from "react";

type SemesterWeekVerifierProps = {
  isOpen: boolean;
  onVerify: (currentWeek: number) => Promise<void>;
};

const WEEKS = Array.from({ length: 20 }, (_, i) => i + 1);

export default function SemesterWeekVerifier({
  isOpen,
  onVerify,
}: SemesterWeekVerifierProps) {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await onVerify(currentWeek);
      setCurrentWeek(1);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify week");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-[color:var(--app-surface)] p-6 text-sm text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
        <div className="text-base font-semibold text-[color:var(--app-text)]">
          Set Current Week
        </div>
        <div className="mt-2 text-xs text-[color:var(--app-subtle)]">
          Which week of the semester are we in? This will be automatically updated every Sunday.
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[color:var(--app-text)]">
              Current Week (1-20)
            </label>
            <select
              value={currentWeek}
              onChange={(e) => setCurrentWeek(Number(e.target.value))}
              className="mt-2 w-full rounded-xl bg-[color:var(--app-panel)] px-3 py-2.5 text-xs text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
              {WEEKS.map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl bg-red-500/10 p-3 text-xs text-red-400 ring-1 ring-red-500/20">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-full bg-cyan-300 px-3.5 py-2 text-xs font-semibold text-black shadow-[0_10px_30px_rgba(34,211,238,0.35)] transition hover:bg-cyan-200 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Verify"}
          </button>
        </div>
      </div>
    </div>
  );
}
