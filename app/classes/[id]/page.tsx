import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import ClassDocumentUploader from "@/app/components/ClassDocumentUploader";
import ClassDocumentList from "@/app/components/ClassDocumentList";
import ClassDeleteButton from "@/app/components/ClassDeleteButton";

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

function startOfWeek(date: Date) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = next.getUTCDay();
  next.setUTCDate(next.getUTCDate() - day);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function computeTermStart(description: string | null, fallback: Date) {
  if (!description) return startOfWeek(fallback);
  const yearMatch = description.match(/(19|20)\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : fallback.getUTCFullYear();
  const lower = description.toLowerCase();

  if (lower.includes("spring")) {
    return startOfWeek(new Date(Date.UTC(year, 0, 10)));
  }
  if (lower.includes("summer")) {
    return startOfWeek(new Date(Date.UTC(year, 5, 1)));
  }
  if (lower.includes("fall") || lower.includes("autumn")) {
    return startOfWeek(new Date(Date.UTC(year, 7, 20)));
  }
  if (lower.includes("winter")) {
    return startOfWeek(new Date(Date.UTC(year, 11, 5)));
  }

  return startOfWeek(fallback);
}

function parseDateFromLine(line: string, now: Date, termStart: Date): ParsedDate | null {
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
    let year = numericMatch[3]
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

  const weekMatch = trimmed.match(/\bweek\s+(\d{1,2})\b/i);
  if (weekMatch) {
    const weekNumber = Number(weekMatch[1]);
    if (weekNumber >= 1 && weekNumber <= 20) {
      const candidate = addDays(termStart, (weekNumber - 1) * 7);
      return { date: candidate, matched: weekMatch[0], confidence: "low" };
    }
  }

  if (/\b(end of term|end of semester|end of quarter)\b/i.test(trimmed)) {
    const candidate = addDays(termStart, 14 * 7);
    return { date: candidate, matched: "end of term", confidence: "low" };
  }

  return null;
}

function extractUpcomingItems(
  docs: Array<{ textExtracted: string | null; filename: string }>,
  now: Date,
  termStart: Date
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
      const parsed = parseDateFromLine(line, now, termStart);
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
  const termStart = computeTermStart(classRecord.description ?? null, new Date());
  const upcomingItems = extractUpcomingItems(highlightDocs, new Date(), termStart);

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

        {upcomingItems.length ? (
          <section className="mt-10">
            <h2 className="text-sm font-semibold tracking-wide text-[color:var(--app-text)]">
              Upcoming
            </h2>
            <div className="mt-4 rounded-3xl bg-[color:var(--app-surface)] p-4 ring-1 ring-[color:var(--app-border)] shadow-[var(--app-shadow)]">
              <div className="text-xs font-medium text-[color:var(--app-subtle)]">
                Dates Found In Your Files
              </div>
              <div className="mt-3 space-y-2">
                {upcomingItems.map((item) => (
                  <div
                    key={`${item.date.toISOString()}-${item.label}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[color:var(--app-panel)] px-4 py-2 text-xs text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)]"
                  >
                    <div className="text-[color:var(--app-text)]">{item.label}</div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--app-subtle)]">
                      <span>{titleCase(item.dateLabel)}</span>
                      <span className="rounded-full bg-[color:var(--app-chip)] px-2 py-0.5 text-[10px] text-[color:var(--app-subtle)] ring-1 ring-[color:var(--app-border)]">
                        {titleCase(item.confidence)} Confidence
                      </span>
                      <span className="rounded-full bg-[color:var(--app-chip)] px-2 py-0.5 text-[10px] text-[color:var(--app-subtle)] ring-1 ring-[color:var(--app-border)]">
                        {item.source}
                      </span>
                    </div>
                  </div>
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
              <ClassDocumentList documents={documents} />
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
