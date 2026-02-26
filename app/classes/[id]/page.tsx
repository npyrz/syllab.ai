import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import ClassDocumentUploader from "@/app/components/ClassDocumentUploader";
import ClassDocumentList from "@/app/components/ClassDocumentList";
import ClassDeleteButton from "@/app/components/ClassDeleteButton";
import WeekDashboardLoader from "@/app/components/WeekDashboardLoader";
import WeeklyScheduleSkeleton from "@/app/components/WeeklyScheduleSkeleton";
import {
  computeEffectiveCurrentWeek,
} from "@/lib/week-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DocumentRow = {
  id: string;
  filename: string;
  status: string;
  createdAt: Date;
  processedAt: Date | null;
};

const HIGHLIGHT_RULES = [
  { label: "grading", patterns: [/grading/i, /grade\s+breakdown/i] },
  { label: "deadlines", patterns: [/deadline/i, /due\s+date/i, /submission/i] },
  { label: "office hours", patterns: [/office\s+hours/i] },
  { label: "attendance", patterns: [/attendance/i, /absen(ce|t)/i] },
  { label: "late policy", patterns: [/late\s+policy/i, /late\s+work/i] },
  { label: "exam schedule", patterns: [/midterm/i, /final\s+exam/i, /exam\s+schedule/i] },
  { label: "contact info", patterns: [/email/i, /contact\s+info/i, /office\s+location/i] },
];

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function extractHighlights(texts: Array<string | null>) {
  const combined = texts
    .filter(Boolean)
    .join("\n")
    .slice(0, 20000);

  if (!combined) return [];

  return HIGHLIGHT_RULES.filter((rule) =>
    rule.patterns.some((pattern) => pattern.test(combined))
  ).map((rule) => rule.label);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatUpcomingDateLabel(date: Date, now: Date): string {
  const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfTargetUtc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const diffDays = Math.round((startOfTargetUtc.getTime() - startOfTodayUtc.getTime()) / 86400000);

  const weekday = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  if (diffDays < 0) return weekday;
  if (diffDays <= 6) return weekday;
  if (diffDays <= 13) return `Next ${weekday}`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function extractScheduleDeadlines(
  scheduleText: string | null,
  currentWeek: number | null,
  now: Date
): UpcomingItem[] {
  if (!scheduleText || !currentWeek) return [];

  const items: UpcomingItem[] = [];
  const deadlinePatterns = [
    /\b(due|deadline|exam|quiz|test|midterm|final|project|submission|homework|assignment|paper|report)\b/i
  ];

  const lines = scheduleText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length >= 6 &&
        line.length <= 150 &&
        deadlinePatterns.some((pattern) => pattern.test(line))
    );

  const weekdayMap: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0,
  };

  for (const line of lines) {
    // Look for day of week mentions in deadline lines
    for (const [dayName, dayNum] of Object.entries(weekdayMap)) {
      if (line.toLowerCase().includes(dayName)) {
        // Calculate the date for this day in the current week
        const nowUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const currentDayOfWeek = nowUtc.getUTCDay();
        const diff = (dayNum - currentDayOfWeek + 7) % 7;
        const targetDate = new Date(nowUtc);
        targetDate.setUTCDate(targetDate.getUTCDate() + diff);

        // Only add if it's in the future (today or later)
        if (targetDate.getTime() >= nowUtc.getTime()) {
          items.push({
            label: line.replace(dayName, "").trim(),
            date: targetDate,
            dateLabel: titleCase(dayName),
            source: "Schedule",
            confidence: "medium",
          });
          break;
        }
      }
    }
  }

  return items;
}

type UpcomingItem = {
  label: string;
  date: Date;
  dateLabel: string;
  source: string;
  confidence: "high" | "medium" | "low";
};

type ParsedDate = {
  date: Date;
  matched: string;
  confidence: "high" | "medium" | "low";
};

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseDateFromLine(line: string, now: Date): ParsedDate | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const monthPattern = new RegExp(
    `\\b(${MONTHS.map((m) => m.slice(0, 3)).join("|")}|${MONTHS.join("|")})\\.?\\s+(\\d{1,2})(?:,\\s*(\\d{4}))?`,
    "i"
  );
  const monthMatch = trimmed.match(monthPattern);

  if (monthMatch) {
    const monthName = monthMatch[1].toLowerCase();
    const monthIndex = MONTHS.findIndex((month) =>
      month.startsWith(monthName.slice(0, 3))
    );
    const day = Number(monthMatch[2]);
    const year = monthMatch[3] ? Number(monthMatch[3]) : now.getFullYear();
    if (monthIndex >= 0) {
      const candidate = new Date(Date.UTC(year, monthIndex, day));
      return { date: candidate, matched: monthMatch[0], confidence: "high" };
    }
  }

  const numericMatch = trimmed.match(
    /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/
  );
  if (numericMatch) {
    const month = Number(numericMatch[1]);
    const day = Number(numericMatch[2]);
    const year = numericMatch[3]
      ? Number(numericMatch[3].length === 2 ? `20${numericMatch[3]}` : numericMatch[3])
      : now.getFullYear();
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(candidate.getTime())) {
      return { date: candidate, matched: numericMatch[0], confidence: "high" };
    }
  }

  const weekdayMatch = trimmed.match(
    /\b(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\b/i
  );
  if (weekdayMatch) {
    const weekdayToken = weekdayMatch[1].toLowerCase();
    const weekdayIndex = WEEKDAYS.findIndex((day) =>
      day.startsWith(weekdayToken.slice(0, 3))
    );
    if (weekdayIndex >= 0) {
      const nowUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const day = nowUtc.getUTCDay();
      const delta = (weekdayIndex - day + 7) % 7 || 7;
      const candidate = addDays(nowUtc, delta);
      return { date: candidate, matched: weekdayMatch[0], confidence: "medium" };
    }
  }

  return null;
}

function extractUpcomingItems(
  docs: Array<{ textExtracted: string | null; filename: string }>,
  now: Date
): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  const nowUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  for (const doc of docs) {
    if (!doc.textExtracted) continue;
    const lines = doc.textExtracted
      .slice(0, 50000)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length >= 6 && line.length <= 140);

    for (const line of lines) {
      const parsed = parseDateFromLine(line, now);
      if (!parsed) continue;

      const date = parsed.date;
      if (date.getTime() < nowUtc.getTime() - 86400000) {
        const bumped = new Date(
          Date.UTC(now.getFullYear() + 1, date.getUTCMonth(), date.getUTCDate())
        );
        if (bumped.getTime() < nowUtc.getTime() - 86400000) continue;
        date.setUTCFullYear(now.getFullYear() + 1);
      }

      const label = line
        .replace(parsed.matched, "")
        .replace(/[\-–—:]+/g, " ")
        .trim();
      if (!label) continue;

      items.push({
        label: label.length > 80 ? `${label.slice(0, 77)}...` : label,
        date,
        dateLabel: parsed.matched,
        source: doc.filename,
        confidence: parsed.confidence,
      });
    }
  }

  const unique = new Map<string, UpcomingItem>();
  for (const item of items) {
    const key = `${item.date.toISOString().slice(0, 10)}-${item.label.toLowerCase()}-${item.source.toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, item);
  }

  return Array.from(unique.values())
    .filter((item) => item.date.getTime() >= nowUtc.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6);
}

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const classId = resolvedParams?.id;
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=%2Fclasses%2F${classId ?? ""}`);

  if (!classId) notFound();

  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
  });

  if (!classRecord) notFound();

  const isOwner = classRecord.userId === session.user.id;
  if (!isOwner) {
    return (
      <div className="relative min-h-[calc(100vh-64px)] bg-[color:var(--app-bg)]">
        <main className="mx-auto w-full max-w-3xl px-6 py-12">
          <div className="rounded-2xl bg-[color:var(--app-surface)] p-5 text-sm text-[color:var(--app-subtle)] ring-1 ring-[color:var(--app-border)]">
            <div className="text-[color:var(--app-text)]">Access Mismatch</div>
            <div className="mt-3 text-xs text-[color:var(--app-muted)]">
              Session user: {session.user.id}
            </div>
            <div className="mt-1 text-xs text-[color:var(--app-muted)]">
              Class owner: {classRecord.userId}
            </div>
            <div className="mt-1 text-xs text-[color:var(--app-muted)]">
              Class Id: {classRecord.id}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const documents: DocumentRow[] = await prisma.document.findMany({
    where: { classId: classRecord.id, userId: classRecord.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      status: true,
      createdAt: true,
      processedAt: true,
    },
  });

  const highlightDocs = await prisma.document.findMany({
    where: {
      classId: classRecord.id,
      userId: classRecord.userId,
      status: "done",
      textExtracted: { not: null },
    },
    select: { textExtracted: true, filename: true },
  });

  const highlights = extractHighlights(
    highlightDocs.map((doc) => doc.textExtracted)
  );

  const now = new Date();
  const effectiveCurrentWeek = computeEffectiveCurrentWeek(classRecord, now);

  if (
    classRecord.currentWeek &&
    effectiveCurrentWeek &&
    effectiveCurrentWeek !== classRecord.currentWeek
  ) {
    await prisma.class.update({
      where: { id: classRecord.id },
      data: {
        currentWeek: effectiveCurrentWeek,
        currentWeekSetAt: now,
      },
    });
  }
  
  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-[color:var(--app-bg)]">
      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-balance text-3xl font-normal tracking-tight text-[color:var(--app-text)]">
              {classRecord.title}
            </h1>
            {classRecord.description ? (
              <p className="text-sm text-[color:var(--app-subtle)]">
                {classRecord.description}
              </p>
            ) : null}
          </div>
          <ClassDeleteButton
            classId={classRecord.id}
            classTitle={classRecord.title}
          />
        </div>

        <Suspense fallback={<WeeklyScheduleSkeleton />}>
          <WeekDashboardLoader
            classId={classRecord.id}
            userId={classRecord.userId}
            currentWeek={effectiveCurrentWeek}
          />
        </Suspense>

        {highlights.length ? (
          <section className="mt-10">
            <h2 className="text-sm font-semibold tracking-wide text-[color:var(--app-text)]">
              Extracted Highlights
            </h2>
            <div className="mt-4 rounded-3xl bg-[color:var(--app-surface)] p-4 ring-1 ring-[color:var(--app-border)] shadow-[var(--app-shadow)]">
              <div className="text-xs font-medium text-[color:var(--app-subtle)]">
                From Your Documents
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {highlights.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full bg-[color:var(--app-chip)] px-3 py-1 text-[11px] font-medium text-[color:var(--app-chip-text)] ring-1 ring-[color:var(--app-border)]"
                  >
                    {titleCase(item)}
                  </span>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-[color:var(--app-text)]">
              Documents
            </h2>
            <div className="text-xs text-[color:var(--app-subtle)]">
              Add Or Manage Class Files
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div>
              <ClassDocumentList classId={classRecord.id} documents={documents} />
            </div>
            <div>
              <ClassDocumentUploader classId={classRecord.id} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
