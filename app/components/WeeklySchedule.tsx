"use client";

import type { WeekScheduleDay } from "@/lib/week-schedule-service";

type WeeklyScheduleProps = {
  currentWeek?: number | null;
  weekStart?: Date;
  weekEnd?: Date;
  days?: WeekScheduleDay[];
};

function formatDate(date: Date | undefined): string {
  if (!date) return "";
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getUTCDate();
  return `${month} ${day}`;
}

function formatEventText(event: string): string {
  const cleaned = event.replace(/\s+/g, " ").trim();

  if (!cleaned) return "";

  const labeled = cleaned.match(
    /^(lecture|discussion|quiz|exam|homework|assignment|lab|project|review|reading|no class)\s*:\s*(.+)$/i
  );
  if (labeled) {
    const rawLabel = labeled[1].toLowerCase();
    const content = labeled[2].trim();
    if (!content) return "";
    const label = rawLabel === "assignment" || rawLabel === "lab" || rawLabel === "project"
      ? "Homework"
      : rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
    return `${label}: ${content}`;
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export default function WeeklySchedule({
  currentWeek,
  weekStart,
  weekEnd,
  days = [],
}: WeeklyScheduleProps) {
  if (!currentWeek) {
    return null;
  }

  const dateRangeText = weekStart && weekEnd 
    ? `${formatDate(weekStart)} - ${formatDate(weekEnd)}`
    : "";

  return (
    <div className="rounded-3xl bg-[color:var(--app-surface)] p-6 ring-1 ring-[color:var(--app-border)] shadow-[var(--app-shadow)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[color:var(--app-text)]">This week</h3>
          <p className="mt-1 text-xs text-[color:var(--app-subtle)]">
            Week {currentWeek}{dateRangeText ? ` • ${dateRangeText}` : ""}
          </p>
        </div>
      </div>

      {days.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {days.map((day) => (
            <div
              key={day.dateISO}
              className="rounded-2xl bg-[color:var(--app-panel)] px-4 py-3.5 ring-1 ring-[color:var(--app-border)] shadow-sm"
            >
              <div className="text-[11px] font-semibold text-[color:var(--app-muted)] mb-2.5">
                {day.dow}
              </div>
              <div className="text-[13px] font-medium leading-relaxed text-[color:var(--app-text)]">
                {formatEventText(day.primary)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-[color:var(--app-panel)] p-4 ring-1 ring-[color:var(--app-border)]">
          <div className="text-[11px] text-[color:var(--app-subtle)]">
            No items for this week.
          </div>
        </div>
      )}
    </div>
  );
}
