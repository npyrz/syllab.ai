/**
 * Utility functions for calculating academic weeks
 */

export function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

export function startOfMondayWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d;
}

export function endOfSundayWeek(date: Date): Date {
  const start = startOfMondayWeek(date);
  start.setUTCDate(start.getUTCDate() + 6);
  return start;
}

export function endOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay() + 6); // Saturday
  return d;
}

/**
 * Get the date range for a given week number.
 * Calculates based on the current week position.
 */
export function getWeekDateRange(currentWeek: number, now: Date): { start: Date; end: Date } | null {
  if (!currentWeek) return null;
  
  // Get the start of this week (Sunday)
  const weekStart = startOfWeek(now);
  
  // Get the end of this week (Saturday)
  const weekEnd = endOfWeek(now);
  
  return { start: weekStart, end: weekEnd };
}

export function weeksElapsed(from: Date, to: Date): number {
  const fromUtc = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const toUtc = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  const diffMs = toUtc.getTime() - fromUtc.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

export function weeksElapsedBySundayBoundary(from: Date, to: Date): number {
  const fromWeekStart = startOfWeek(from);
  const toWeekStart = startOfWeek(to);
  const diffMs = toWeekStart.getTime() - fromWeekStart.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Compute the effective current week for a class.
 * Uses the stored currentWeek and adds elapsed weeks since the class was created.
 * If no currentWeek is stored, returns null (no fallback to semester-based calculation).
 */
export function computeEffectiveCurrentWeek(classRecord: {
  currentWeek: number | null;
  createdAt: Date;
  currentWeekSetAt?: Date | null;
}, now: Date = new Date()): number | null {
  if (!classRecord.currentWeek) {
    return null;
  }

  const anchorDate = classRecord.currentWeekSetAt ?? classRecord.createdAt;
  const elapsed = weeksElapsedBySundayBoundary(anchorDate, now);
  return Math.max(1, Math.min(20, classRecord.currentWeek + elapsed));
}

export function computeWeekStartEnd(week: number, termStart: Date): { weekStartISO: string; weekEndISO: string } {
  const normalizedWeek = Math.max(1, week);
  const termStartMonday = startOfMondayWeek(termStart);

  const weekStart = new Date(termStartMonday);
  weekStart.setUTCDate(termStartMonday.getUTCDate() + (normalizedWeek - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  return {
    weekStartISO: weekStart.toISOString().slice(0, 10),
    weekEndISO: weekEnd.toISOString().slice(0, 10),
  };
}

export function formatDueDowLabel(dueDateISO: string, weekStartISO: string, weekEndISO: string): string {
  const due = new Date(`${dueDateISO}T00:00:00Z`);
  if (Number.isNaN(due.getTime())) return "";

  const weekStart = new Date(`${weekStartISO}T00:00:00Z`);
  const weekEnd = new Date(`${weekEndISO}T00:00:00Z`);

  const weekday = due.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  if (due.getTime() >= weekStart.getTime() && due.getTime() <= weekEnd.getTime()) {
    return weekday;
  }

  return `Next ${weekday}`;
}

