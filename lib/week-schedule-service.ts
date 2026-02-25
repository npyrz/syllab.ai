import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  computeEffectiveCurrentWeek,
  computeWeekStartEnd,
  formatDueDowLabel,
  startOfMondayWeek,
} from "@/lib/week-utils";

const DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type Dow = (typeof DOWS)[number];

export type WeekRawRow = {
  dateISO: string;
  dateToken: string;
  lectureCell?: string;
  discussionCell?: string;
  quizCell?: string;
  sectionCell?: string;
  notes?: string;
};

export type WeekScheduleDay = {
  dateISO: string;
  dow: Dow;
  primary: string;
  secondary?: string[];
  tags?: string[];
  source?: "ai";
};

export type WeekScheduleUpcoming = {
  title: string;
  dueDateISO: string;
  dueDowLabel: string;
};

export type WeekScheduleRecordData = {
  classId: string;
  week: number;
  weekStartISO: string;
  weekEndISO: string;
  days: WeekScheduleDay[];
  upcoming: WeekScheduleUpcoming[];
  generatedAtISO: string;
  scheduleFingerprint: string;
  syllabusFingerprint: string;
  model: string;
};

function isMissingWeekScheduleTableError(error: unknown): boolean {
  const value = error as { code?: unknown; meta?: unknown } | null;
  if (!value || typeof value !== "object") return false;

  const code = typeof value.code === "string" ? value.code : "";
  if (code !== "P2021") return false;

  const table =
    value.meta && typeof value.meta === "object"
      ? String((value.meta as { table?: unknown }).table ?? "")
      : "";

  return String(table).toLowerCase().includes("weekschedule");
}

function normalizeDateString(input: string): { iso: string; label: string } | null {
  const patterns = [
    /(\d{1,2})[\s\-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(,?\s*\d{4})?/i,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(\s+|\-)(\d{1,2})(,?\s*\d{4})?/i,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = input.trim().match(pattern);
    if (!match) continue;

    let day: number | null = null;
    let monthStr: string | null = null;
    let year = new Date().getUTCFullYear();

    if (i === 0) {
      day = Number.parseInt(match[1], 10);
      monthStr = match[2];
      if (match[3]) {
        const extractedYear = Number.parseInt(match[3].replace(/[^\d]/g, ""), 10);
        if (!Number.isNaN(extractedYear)) year = extractedYear;
      }
    } else {
      monthStr = match[1];
      day = Number.parseInt(match[3], 10);
      if (match[4]) {
        const extractedYear = Number.parseInt(match[4].replace(/[^\d]/g, ""), 10);
        if (!Number.isNaN(extractedYear)) year = extractedYear;
      }
    }

    if (!day || !monthStr) continue;

    const monthIndex = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ].findIndex((m) => m.toLowerCase() === monthStr.toLowerCase().slice(0, 3));

    if (monthIndex < 0) continue;

    const date = new Date(Date.UTC(year, monthIndex, day));
    if (Number.isNaN(date.getTime())) continue;

    return {
      iso: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    };
  }

  return null;
}

function normalizeScheduleTextForModel(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(
      /(Week\s*)((?:[1-9]|1\d|20))((?:0?[1-9]|[12]\d|3[01])\s*[-/](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*)/gi,
      "$1$2 $3"
    )
    .replace(/(Week\s*\d{1,2})\s*(?=\d{1,2}\s*[-/])/gi, "$1\n")
    .replace(/(?<!\n)(Week\s*\d{1,2}\b)/gi, "\n$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findWeekMarkers(text: string): Array<{ week: number; index: number }> {
  const markers: Array<{ week: number; index: number }> = [];
  const regex = /\b(?:week|wk)\s*0?([1-9]|1\d|20)\b/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const week = Number.parseInt(match[1], 10);
    if (!Number.isNaN(week)) {
      markers.push({ week, index: match.index });
    }
  }

  return markers;
}

function getExactWeekBlock(scheduleText: string, currentWeek: number): string {
  const normalized = normalizeScheduleTextForModel(scheduleText);
  const markers = findWeekMarkers(normalized);
  const exactIndex = markers.findIndex((entry) => entry.week === currentWeek);

  if (exactIndex < 0) return "";

  const start = markers[exactIndex].index;
  const end = exactIndex + 1 < markers.length ? markers[exactIndex + 1].index : normalized.length;
  return normalized.slice(start, end);
}

function cleanSegmentText(segment: string): string {
  return segment
    .replace(/\bweek\s*\d+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSectionLikeTokens(segment: string): string[] {
  const matches = segment.match(/\b\d+(?:\.\d+)?(?:\s*[-–&]\s*\d+(?:\.\d+)?)*\b/g);
  return (matches ?? []).map((value) => value.trim());
}

function extractNotes(segment: string): string | undefined {
  const phraseMatches = segment.match(/\b(?:no\s+quiz|no\s+class|holiday|mlk\s+day|exam|midterm|final|review)\b[^.,;]*/gi);
  if (!phraseMatches || phraseMatches.length === 0) return undefined;
  return phraseMatches.join("; ").trim();
}

export function extractWeekRows(scheduleText: string, currentWeek: number): WeekRawRow[] {
  const weekBlock = getExactWeekBlock(scheduleText, currentWeek);
  if (!weekBlock) return [];

  const dateRegex = /(\d{1,2})\s*[-/]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*/gi;
  const dateMatches = Array.from(weekBlock.matchAll(dateRegex));
  if (dateMatches.length === 0) return [];

  const rows: WeekRawRow[] = [];

  for (let index = 0; index < dateMatches.length; index++) {
    const match = dateMatches[index];
    const tokenStart = (match.index ?? 0) + match[0].length;
    const tokenEnd =
      index + 1 < dateMatches.length
        ? (dateMatches[index + 1].index ?? weekBlock.length)
        : weekBlock.length;

    const dateToken = `${match[1]}-${match[2]}`;
    const normalizedDate = normalizeDateString(dateToken);
    if (!normalizedDate) continue;

    const segment = cleanSegmentText(weekBlock.slice(tokenStart, tokenEnd));
    const sectionLike = extractSectionLikeTokens(segment);
    const notes = extractNotes(segment);

    const row: WeekRawRow = {
      dateISO: normalizedDate.iso,
      dateToken,
      notes,
    };

    if (/\bno\s+quiz\b/i.test(segment)) {
      row.quizCell = "No Quiz";
    }

    if (sectionLike.length > 0) row.lectureCell = sectionLike[0];
    if (sectionLike.length > 1) row.discussionCell = sectionLike[1];
    if (sectionLike.length > 2 && !row.quizCell) row.quizCell = sectionLike[2];
    if (sectionLike.length > 3) row.sectionCell = sectionLike[3];

    rows.push(row);
  }

  return rows;
}

function extractSyllabusHints(syllabusText: string | null): string {
  if (!syllabusText) return "";

  const lines = syllabusText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) =>
      /\b(quiz|exam|midterm|final|discussion|lecture|reading|homework|assignment|lab|project|due|section)\b/i.test(line)
    )
    .slice(0, 16);

  return lines.join("\n").slice(0, 1800);
}

function toDow(dateISO: string): Dow {
  const date = new Date(`${dateISO}T00:00:00Z`);
  const weekday = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  if (DOWS.includes(weekday as Dow)) return weekday as Dow;
  return "Mon";
}

function getScheduleFingerprint(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function resolveGroqModel(): string {
  const configured = (process.env.GROQ_SCHEDULE_MODEL ?? process.env.GROQ_MODEL ?? "").trim();
  if (!configured) return "llama-3.3-70b-versatile";

  const normalized = configured.toLowerCase();
  if (normalized === "openai/gpt-oss-120b" || normalized.includes("gpt-oss")) {
    return "llama-3.3-70b-versatile";
  }

  return configured;
}

function compactPrimary(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return "No items";

  const words = cleaned.split(" ");
  if (words.length <= 6) return cleaned;
  return words.slice(0, 6).join(" ");
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const raw = text.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (!objectMatch) return null;
    try {
      const parsed = JSON.parse(objectMatch[0]) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
}

function normalizeDays(params: {
  weekStartISO: string;
  modelDays: unknown;
  weekRows: WeekRawRow[];
}): WeekScheduleDay[] {
  const weekStart = new Date(`${params.weekStartISO}T00:00:00Z`);
  const byDate = new Map<string, WeekRawRow>();
  for (const row of params.weekRows) byDate.set(row.dateISO, row);

  const modelMap = new Map<string, { primary: string; tags?: string[] }>();
  if (Array.isArray(params.modelDays)) {
    for (const item of params.modelDays) {
      if (!item || typeof item !== "object") continue;
      const value = item as Record<string, unknown>;
      if (typeof value.date !== "string" || typeof value.primary !== "string") continue;

      modelMap.set(value.date, {
        primary: compactPrimary(value.primary),
        tags: Array.isArray(value.tags)
          ? value.tags.filter((tag): tag is string => typeof tag === "string")
          : undefined,
      });
    }
  }

  const days: WeekScheduleDay[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(weekStart);
    date.setUTCDate(date.getUTCDate() + offset);
    const dateISO = date.toISOString().slice(0, 10);

    const fromModel = modelMap.get(dateISO);
    const row = byDate.get(dateISO);

    let primary = fromModel?.primary ?? "No items";
    if (!fromModel && row) {
      if (row.notes && /no\s+class|holiday|mlk\s+day/i.test(row.notes)) {
        primary = "No class";
      } else if (row.quizCell && !/no\s+quiz/i.test(row.quizCell)) {
        primary = `Quiz: ${row.quizCell}`;
      } else if (row.lectureCell) {
        primary = `Lecture: ${row.lectureCell}`;
      } else if (row.discussionCell) {
        primary = `Discussion: ${row.discussionCell}`;
      }
    }

    days.push({
      dateISO,
      dow: toDow(dateISO),
      primary: compactPrimary(primary),
      tags: fromModel?.tags,
      source: "ai",
    });
  }

  return days;
}

function normalizeUpcoming(params: {
  modelUpcoming: unknown;
  days: WeekScheduleDay[];
  weekStartISO: string;
  weekEndISO: string;
}): WeekScheduleUpcoming[] {
  const items: WeekScheduleUpcoming[] = [];

  if (Array.isArray(params.modelUpcoming)) {
    for (const item of params.modelUpcoming) {
      if (!item || typeof item !== "object") continue;
      const value = item as Record<string, unknown>;
      if (typeof value.title !== "string" || typeof value.dueDate !== "string") continue;

      const dueDateISO = value.dueDate.slice(0, 10);
      items.push({
        title: compactPrimary(value.title),
        dueDateISO,
        dueDowLabel:
          typeof value.dueDowLabel === "string" && value.dueDowLabel.trim().length > 0
            ? value.dueDowLabel.trim()
            : formatDueDowLabel(dueDateISO, params.weekStartISO, params.weekEndISO),
      });
    }
  }

  if (items.length >= 3) {
    return items.slice(0, 3);
  }

  const derived = params.days
    .filter((day) => day.primary.toLowerCase() !== "no items")
    .map((day) => ({
      title: day.primary,
      dueDateISO: day.dateISO,
      dueDowLabel: formatDueDowLabel(day.dateISO, params.weekStartISO, params.weekEndISO),
    }));

  return [...items, ...derived].slice(0, 3);
}

async function generateWeekScheduleFromStructuredInput(params: {
  currentWeek: number;
  weekStartISO: string;
  weekEndISO: string;
  weekRows: WeekRawRow[];
  syllabusHints: string;
  modelName: string;
}) {
  const prompt = `Build a weekly dashboard schedule for Week ${params.currentWeek} (${params.weekStartISO} to ${params.weekEndISO}).

You are given:
1) weekRows: structured rows for this week from the official course schedule
2) syllabusHints: brief context about course format and what lecture/discussion/quiz/sections usually mean

OUTPUT (JSON only) must match this schema exactly:
{
  "days": [
    { "date": "YYYY-MM-DD", "dow": "Mon", "primary": "2-5 words", "tags": ["..."] }
  ],
  "upcoming": [
    { "title": "short title", "dueDate": "YYYY-MM-DD", "dueDowLabel": "Mon|Tue|...|Next Wed" }
  ]
}

RULES:
- days must include ALL 7 days in the week (Mon-Sun) in chronological order.
- primary must be compact, action-oriented.
- Do NOT include dates inside primary.
- Use syllabusHints to interpret whether section numbers imply reading or problem sets.
- If row contains "No Quiz" or "No class", primary should reflect that.
- For days with no row, set primary to "No items".
- upcoming: include the next 3 meaningful due items.
- dueDowLabel: use "Mon/Tue/..." if within this week; use "Next Mon/Next Tue/..." if outside this week.

weekRows JSON:
${JSON.stringify(params.weekRows)}

syllabusHints:
${params.syllabusHints || "(none)"}

Return JSON only.`;

  const modelResult = await generateText({
    model: groq(params.modelName),
    temperature: 0,
    maxOutputTokens: 900,
    maxRetries: 0,
    providerOptions: {
      groq: {
        response_format: { type: "json_object" },
      },
    },
    system:
      "You are a schedule planner that converts structured weekly rows into dashboard-ready cards. You MUST return valid JSON only with no markdown or commentary. NEVER return an empty string.",
    prompt,
  });

  const parsed = parseJsonObject(modelResult.text);

  if (!parsed) {
    console.warn("[WeekSchedule] Groq returned invalid or empty JSON payload; using structured weekRows normalization.", {
      model: params.modelName,
      week: params.currentWeek,
      responseLength: modelResult.text.length,
      responsePreview: modelResult.text.slice(0, 300),
    });
  }

  const modelPayload = parsed ?? {};

  const days = normalizeDays({
    weekStartISO: params.weekStartISO,
    modelDays: (modelPayload as Record<string, unknown>).days,
    weekRows: params.weekRows,
  });

  const upcoming = normalizeUpcoming({
    modelUpcoming: (modelPayload as Record<string, unknown>).upcoming,
    days,
    weekStartISO: params.weekStartISO,
    weekEndISO: params.weekEndISO,
  });

  return { days, upcoming };
}

function resolveTermStart(anchorDate: Date, currentWeek: number): Date {
  const anchorMonday = startOfMondayWeek(anchorDate);
  const termStart = new Date(anchorMonday);
  termStart.setUTCDate(anchorMonday.getUTCDate() - (Math.max(1, currentWeek) - 1) * 7);
  return termStart;
}

async function resolveClassTexts(params: { classId: string; userId: string }) {
  const classRecord = await prisma.class.findFirst({
    where: {
      id: params.classId,
      userId: params.userId,
    },
    select: {
      id: true,
      userId: true,
      currentWeek: true,
      currentWeekSetAt: true,
      createdAt: true,
      scheduleId: true,
    },
  });

  if (!classRecord) return null;

  const scheduleDocFromFlag = classRecord.scheduleId
    ? await prisma.document.findFirst({
        where: {
          id: classRecord.scheduleId,
          classId: classRecord.id,
          userId: params.userId,
          status: "done",
          textExtracted: { not: null },
        },
        select: {
          id: true,
          textExtracted: true,
        },
      })
    : null;

  const scheduleDocFallback = !scheduleDocFromFlag
    ? await prisma.document.findFirst({
        where: {
          classId: classRecord.id,
          userId: params.userId,
          status: "done",
          textExtracted: { not: null },
          OR: [
            { docType: "schedule" },
            { filename: { contains: "schedule", mode: "insensitive" } },
            { filename: { contains: "calendar", mode: "insensitive" } },
            { filename: { contains: "week", mode: "insensitive" } },
            { filename: { contains: "timetable", mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          textExtracted: true,
        },
      })
    : null;

  const syllabusDoc = await prisma.document.findFirst({
    where: {
      classId: classRecord.id,
      userId: params.userId,
      status: "done",
      textExtracted: { not: null },
      OR: [{ docType: "syllabus" }, { filename: { contains: "syllabus", mode: "insensitive" } }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      textExtracted: true,
    },
  });

  return {
    classRecord,
    scheduleText: scheduleDocFromFlag?.textExtracted ?? scheduleDocFallback?.textExtracted ?? null,
    syllabusText: syllabusDoc?.textExtracted ?? null,
  };
}

export async function getOrCreateWeekScheduleForClass(params: {
  classId: string;
  userId: string;
  targetWeek?: number;
}): Promise<WeekScheduleRecordData | null> {
  const resolved = await resolveClassTexts(params);
  if (!resolved?.classRecord || !resolved.scheduleText) return null;

  const classRecord = resolved.classRecord;
  const effectiveWeek = computeEffectiveCurrentWeek(classRecord, new Date());
  const requestedWeek = params.targetWeek ?? effectiveWeek;

  if (!requestedWeek || requestedWeek < 1) return null;

  const week = Math.min(20, requestedWeek);
  const scheduleFingerprint = getScheduleFingerprint(resolved.scheduleText);
  const syllabusHints = extractSyllabusHints(resolved.syllabusText);
  const syllabusFingerprint = getScheduleFingerprint(syllabusHints || "none");

  let existing:
    | {
        classId: string;
        week: number;
        weekStartISO: string;
        weekEndISO: string;
        days: Prisma.JsonValue;
        upcoming: Prisma.JsonValue;
        generatedAtISO: string;
        scheduleFingerprint: string;
        syllabusFingerprint: string;
        model: string;
      }
    | null = null;

  let canPersistWeekSchedule = true;

  try {
    existing = await prisma.weekSchedule.findFirst({
      where: {
        classId: classRecord.id,
        week,
        scheduleFingerprint,
        syllabusFingerprint,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    if (isMissingWeekScheduleTableError(error)) {
      canPersistWeekSchedule = false;
      console.warn("[WeekSchedule] WeekSchedule table missing. Returning non-persistent generated schedule.");
    } else {
      throw error;
    }
  }

  if (existing) {
    return {
      classId: existing.classId,
      week: existing.week,
      weekStartISO: existing.weekStartISO,
      weekEndISO: existing.weekEndISO,
      days: existing.days as WeekScheduleDay[],
      upcoming: existing.upcoming as WeekScheduleUpcoming[],
      generatedAtISO: existing.generatedAtISO,
      scheduleFingerprint: existing.scheduleFingerprint,
      syllabusFingerprint: existing.syllabusFingerprint,
      model: existing.model,
    };
  }

  const currentWeek = effectiveWeek ?? classRecord.currentWeek ?? week;
  const anchorDate = classRecord.currentWeekSetAt ?? classRecord.createdAt;
  const termStart = resolveTermStart(anchorDate, currentWeek);
  const { weekStartISO, weekEndISO } = computeWeekStartEnd(week, termStart);

  const weekRows = extractWeekRows(resolved.scheduleText, week);
  const modelName = resolveGroqModel();

  const { days, upcoming } = await generateWeekScheduleFromStructuredInput({
    currentWeek: week,
    weekStartISO,
    weekEndISO,
    weekRows,
    syllabusHints,
    modelName,
  });

  const generatedAtISO = new Date().toISOString();

  if (!canPersistWeekSchedule) {
    return {
      classId: classRecord.id,
      week,
      weekStartISO,
      weekEndISO,
      days,
      upcoming,
      generatedAtISO,
      scheduleFingerprint,
      syllabusFingerprint,
      model: modelName,
    };
  }

  const created = await prisma.weekSchedule.create({
    data: {
      classId: classRecord.id,
      week,
      weekStartISO,
      weekEndISO,
      days: days,
      upcoming: upcoming,
      generatedAtISO,
      scheduleFingerprint,
      syllabusFingerprint,
      model: modelName,
    },
  });

  return {
    classId: created.classId,
    week: created.week,
    weekStartISO: created.weekStartISO,
    weekEndISO: created.weekEndISO,
    days: created.days as WeekScheduleDay[],
    upcoming: created.upcoming as WeekScheduleUpcoming[],
    generatedAtISO: created.generatedAtISO,
    scheduleFingerprint: created.scheduleFingerprint,
    syllabusFingerprint: created.syllabusFingerprint,
    model: created.model,
  };
}

export async function precomputeNextWeekSchedulesForActiveClasses() {
  const classes = await prisma.class.findMany({
    where: {
      currentWeek: { not: null },
    },
    select: {
      id: true,
      userId: true,
      currentWeek: true,
      currentWeekSetAt: true,
      createdAt: true,
    },
  });

  let generatedCount = 0;

  for (const classRecord of classes) {
    const effectiveWeek = computeEffectiveCurrentWeek(classRecord, new Date());
    if (!effectiveWeek) continue;

    const targetWeek = Math.min(20, effectiveWeek + 1);
    try {
      const result = await getOrCreateWeekScheduleForClass({
        classId: classRecord.id,
        userId: classRecord.userId,
        targetWeek,
      });

      if (result) generatedCount += 1;
    } catch (error) {
      console.error("[WeekSchedule] Failed to precompute", {
        classId: classRecord.id,
        targetWeek,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { generatedCount, scannedClasses: classes.length };
}
