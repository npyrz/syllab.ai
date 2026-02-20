"use client";

type WeeklyScheduleProps = {
  currentWeek?: number | null;
  semester?: string | null;
  weekItems?: string[];
};

export default function WeeklySchedule({
  currentWeek,
  semester,
  weekItems,
}: WeeklyScheduleProps) {
  if (!currentWeek) {
    return null;
  }

  return (
    <div className="rounded-3xl bg-[color:var(--app-surface)] p-6 ring-1 ring-[color:var(--app-border)] shadow-[var(--app-shadow)]">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[color:var(--app-text)]">
          Week {currentWeek}
          {semester && ` • ${semester}`}
        </h3>
        <p className="mt-1 text-xs text-[color:var(--app-subtle)]">Course Schedule</p>
      </div>

      {weekItems && weekItems.length > 0 ? (
        <div className="mb-4 rounded-2xl bg-[color:var(--app-panel)] p-3 ring-1 ring-[color:var(--app-border)]">
          <div className="text-xs font-semibold text-[color:var(--app-text)]">
            This Week
          </div>
          <ul className="mt-2 space-y-1.5">
            {weekItems.map((item, idx) => (
              <li key={`${item}-${idx}`} className="text-[11px] text-[color:var(--app-text)]">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!weekItems || weekItems.length === 0 ? (
        <div className="mb-4 rounded-2xl bg-[color:var(--app-panel)] p-3 text-[11px] text-[color:var(--app-subtle)] ring-1 ring-[color:var(--app-border)]">
          No week-specific items were returned yet for this week. We will keep using your flagged schedule document as the source.
        </div>
      ) : null}
    </div>
  );
}
