import Groq from "groq-sdk";
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
const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SCHEDULE_TEMPERATURE = Number.parseFloat(process.env.GROQ_SCHEDULE_TEMPERATURE ?? "0.15");
const SCHEDULE_REASONING_EFFORT =
  (process.env.GROQ_SCHEDULE_REASONING_EFFORT?.trim() || "low") as "none" | "low" | "medium" | "high";

type Dow = (typeof DOWS)[number];

function clampTemperature(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(2, Math.max(0, value));
}

function supportsReasoningEffort(modelName: string) {
  const normalized = modelName.toLowerCase();
  return normalized.includes("gpt-oss") || normalized.includes("qwen3") || normalized.includes("deepseek-r1");
}

export type WeekRawRow = {
  dateISO: string;
  dateToken: string;
  lectureCell?: string;
  discussionCell?: string;
  labCell?: string;
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
  const value = input.trim();
  if (!value) return null;

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const fromYmd = value.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (fromYmd) {
    const year = Number.parseInt(fromYmd[1], 10);
    const monthIndex = Number.parseInt(fromYmd[2], 10) - 1;
    const day = Number.parseInt(fromYmd[3], 10);
    const date = new Date(Date.UTC(year, monthIndex, day));
    if (!Number.isNaN(date.getTime())) {
      return {
        iso: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      };
    }
  }

  const dayMonth = value.match(
    /^(\d{1,2})[\s\-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:,?\s*(\d{4}))?$/i
  );
  const monthDay = value.match(
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+|\-)(\d{1,2})(?:,?\s*(\d{4}))?$/i
  );
  const numericMd = value.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);

  let day: number | null = null;
  let monthIndex = -1;
  let year = new Date().getUTCFullYear();

  if (dayMonth) {
    day = Number.parseInt(dayMonth[1], 10);
    monthIndex = monthNames.findIndex((m) => m.toLowerCase() === dayMonth[2].toLowerCase().slice(0, 3));
    if (dayMonth[3]) year = Number.parseInt(dayMonth[3], 10);
  } else if (monthDay) {
    day = Number.parseInt(monthDay[2], 10);
    monthIndex = monthNames.findIndex((m) => m.toLowerCase() === monthDay[1].toLowerCase().slice(0, 3));
    if (monthDay[3]) year = Number.parseInt(monthDay[3], 10);
  } else if (numericMd) {
    const month = Number.parseInt(numericMd[1], 10);
    day = Number.parseInt(numericMd[2], 10);
    monthIndex = month - 1;
    if (numericMd[3]) {
      const parsedYear = Number.parseInt(numericMd[3], 10);
      year = parsedYear < 100 ? 2000 + parsedYear : parsedYear;
    }
  }

  if (!day || monthIndex < 0 || monthIndex > 11 || Number.isNaN(year)) return null;

  const date = new Date(Date.UTC(year, monthIndex, day));
  if (Number.isNaN(date.getTime())) return null;

  return {
    iso: date.toISOString().slice(0, 10),
    label: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
  };
}

function truncateLikelyAppendixSections(text: string): string {
  const headingRegex =
    /(?:^|\n)\s*(Section\s+Number|Section\s+Title|MyLab\s+Homework\s+Due\s+Date|Homework\s+Due\s+Date|Course\s+Policies|Grading\s+Policy|Office\s+Hours)\b/gi;
  const match = headingRegex.exec(text);
  if (!match || typeof match.index !== "number") return text;
  if (match.index < 120) return text;
  return text.slice(0, match.index).trim();
}

function normalizeScheduleTextForModel(text: string): string {
  const trimmed = truncateLikelyAppendixSections(text);

  return trimmed
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(
      /(Week\s*)((?:[1-9]|1\d|20))((?:0?[1-9]|[12]\d|3[01])\s*[-/](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*)/gi,
      "$1$2 $3"
    )
    .replace(/(Week\s*\d{1,2})\s*(?=\d{1,2}\s*[-/])/gi, "$1\n")
    .replace(/(?<!\n)(Week\s*\d{1,2}\b)/gi, "\n$1")
    .replace(
      /((?:\d{1,2}\s*[-/]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s*\d{1,2}(?:\s*,\s*\d{4})?))(?=\s+(?:\d{1,2}\s*[-/]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s*\d{1,2}\b))/gi,
      "$1\n"
    )
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
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

function getBestWeekBlock(scheduleText: string, currentWeek: number): { text: string; exactWeekMatch: boolean } {
  const normalized = normalizeScheduleTextForModel(scheduleText);
  const markers = findWeekMarkers(normalized);
  if (markers.length === 0) {
    return { text: normalized.slice(0, 12000), exactWeekMatch: false };
  }

  const exactIndex = markers.findIndex((entry) => entry.week === currentWeek);

  if (exactIndex >= 0) {
    const start = markers[exactIndex].index;
    const end = exactIndex + 1 < markers.length ? markers[exactIndex + 1].index : normalized.length;
    return { text: normalized.slice(start, end), exactWeekMatch: true };
  }

  const nearestIndex = markers.reduce((best, entry, idx) => {
    const bestDistance = Math.abs(markers[best].week - currentWeek);
    const currentDistance = Math.abs(entry.week - currentWeek);
    return currentDistance < bestDistance ? idx : best;
  }, 0);

  const start = Math.max(0, markers[nearestIndex].index - 120);
  const end =
    nearestIndex + 1 < markers.length
      ? Math.min(normalized.length, markers[nearestIndex + 1].index + 120)
      : Math.min(normalized.length, markers[nearestIndex].index + 1800);

  return { text: normalized.slice(start, end), exactWeekMatch: false };
}

function cleanSegmentText(segment: string): string {
  const withoutAppendix = segment
    .split(/\b(?:Section\s+Number|Section\s+Title|MyLab\s+Homework\s+Due\s+Date|Homework\s+Due\s+Date|Course\s+Policies|Grading\s+Policy)\b/i)[0] ?? "";

  return withoutAppendix
    .replace(/\bweek\s*\d+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSectionLikeTokens(segment: string): string[] {
  const matches = segment.match(/\b\d+\.\d+(?:\s*(?:[-–&]|and|,)\s*\d+\.\d+)*\b/gi);
  return (matches ?? []).map((value) => value.trim());
}

function extractKeywordCell(segment: string, kind: "lecture" | "discussion" | "lab" | "quiz" | "homework" | "exam"): string | undefined {
  const regexByKind: Record<typeof kind, RegExp> = {
    lecture: /(?:lecture|topic|reading)\s*[:\-]?\s*([^|;,.]+)/i,
    discussion: /(?:discussion|recitation)\s*[:\-]?\s*([^|;,.]+)/i,
    lab: /(?:lab|laboratory|studio)\s*[:\-]?\s*([^|;,.]+)/i,
    quiz: /(?:quiz|checkpoint)\s*[:\-]?\s*([^|;,.]+)/i,
    homework: /(?:homework|assignment|project|lab|problem\s*set|pset|due)\s*[:\-]?\s*([^|;,.]+)/i,
    exam: /(?:exam|midterm|final)\s*[:\-]?\s*([^|;,.]+)/i,
  };

  const match = segment.match(regexByKind[kind]);
  if (!match) return undefined;
  return match[1]?.trim() || kind;
}

function extractNotes(segment: string): string | undefined {
  const phraseMatches = segment.match(
    /\b(?:no\s+quiz|no\s+class|holiday|mlk\s+day|exam|midterm|final|review|deadline|due|submit|submission|spring\s+break)\b[^\n.;]*/gi
  );
  if (!phraseMatches || phraseMatches.length === 0) return undefined;
  return phraseMatches.join("; ").slice(0, 180).trim();
}

type DateMatch = {
  start: number;
  end: number;
  dateToken: string;
  dateISO: string;
};

function findDateMatches(text: string): DateMatch[] {
  const matches: DateMatch[] = [];
  const patterns: Array<{ regex: RegExp; tokenBuilder: (match: RegExpExecArray) => string | null }> = [
    {
      regex: /(\d{1,2})\s*[-/]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*/gi,
      tokenBuilder: (match) => `${match[1]} ${match[2]}`,
    },
    {
      regex: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s*(\d{1,2})(?:\s*,\s*(\d{4}))?/gi,
      tokenBuilder: (match) => `${match[1]} ${match[2]}${match[3] ? ` ${match[3]}` : ""}`,
    },
    {
      regex: /\b(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})\b/g,
      tokenBuilder: (match) => match[1],
    },
    {
      regex: /\b(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)\b/g,
      tokenBuilder: (match) => match[1],
    },
  ];

  for (const entry of patterns) {
    let match: RegExpExecArray | null;
    while ((match = entry.regex.exec(text)) !== null) {
      const token = entry.tokenBuilder(match);
      if (!token) continue;

      const normalizedDate = normalizeDateString(token);
      if (!normalizedDate) continue;

      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        dateToken: token,
        dateISO: normalizedDate.iso,
      });
    }
  }

  const seen = new Set<string>();
  return matches
    .sort((a, b) => a.start - b.start)
    .filter((entry) => {
      const key = `${entry.start}-${entry.dateISO}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function extractWeekRows(
  scheduleText: string,
  currentWeek: number,
  dateRange?: { weekStartISO: string; weekEndISO: string }
): WeekRawRow[] {
  const weekBlock = getBestWeekBlock(scheduleText, currentWeek).text;
  if (!weekBlock) return [];

  const dateMatches = findDateMatches(weekBlock);
  if (dateMatches.length === 0) return [];

  const rows: WeekRawRow[] = [];

  for (let index = 0; index < dateMatches.length; index++) {
    const match = dateMatches[index];
    const tokenStart = match.end;
    const tokenEnd =
      index + 1 < dateMatches.length
        ? dateMatches[index + 1].start
        : weekBlock.length;

    const segment = cleanSegmentText(weekBlock.slice(tokenStart, tokenEnd));
    const sectionLike = extractSectionLikeTokens(segment);
    const notes = extractNotes(segment);

    const row: WeekRawRow = {
      dateISO: match.dateISO,
      dateToken: match.dateToken,
      notes,
    };

    const lectureFromKeyword = extractKeywordCell(segment, "lecture");
    const discussionFromKeyword = extractKeywordCell(segment, "discussion");
    const labFromKeyword = extractKeywordCell(segment, "lab");
    const quizFromKeyword = extractKeywordCell(segment, "quiz");
    const homeworkFromKeyword = extractKeywordCell(segment, "homework");
    const examFromKeyword = extractKeywordCell(segment, "exam");

    if (/\bno\s+quiz\b/i.test(segment)) {
      row.quizCell = "No Quiz";
    }

    if (/\b(?:spring\s+break|no\s+class|holiday|mlk\s+day)\b/i.test(segment)) {
      row.notes = [row.notes, "No class"].filter(Boolean).join("; ");
    }

    row.lectureCell = lectureFromKeyword ?? sectionLike[0];
    row.discussionCell = discussionFromKeyword ?? sectionLike[1];
    row.labCell = labFromKeyword;
    row.quizCell = row.quizCell ?? quizFromKeyword ?? (row.quizCell ? undefined : sectionLike[2]);

    // Keep homework/exam hints in sectionCell so fallback normalization can surface them.
    row.sectionCell = examFromKeyword ?? homeworkFromKeyword ?? sectionLike[3];

    rows.push(row);
  }

  const deduped = new Map<string, WeekRawRow>();
  for (const row of rows) {
    const existing = deduped.get(row.dateISO);
    if (!existing) {
      deduped.set(row.dateISO, row);
      continue;
    }

    deduped.set(row.dateISO, {
      ...existing,
      lectureCell: existing.lectureCell ?? row.lectureCell,
      discussionCell: existing.discussionCell ?? row.discussionCell,
      labCell: existing.labCell ?? row.labCell,
      quizCell: existing.quizCell ?? row.quizCell,
      sectionCell: existing.sectionCell ?? row.sectionCell,
      notes: [existing.notes, row.notes].filter(Boolean).join("; ") || undefined,
    });
  }

  const sorted = Array.from(deduped.values()).sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  if (!dateRange) return sorted;

  const start = new Date(`${dateRange.weekStartISO}T00:00:00Z`).getTime();
  const end = new Date(`${dateRange.weekEndISO}T23:59:59Z`).getTime();

  const filtered = sorted.filter((row) => {
    const time = new Date(`${row.dateISO}T00:00:00Z`).getTime();
    return Number.isFinite(time) && time >= start && time <= end;
  });

  return filtered.length > 0 ? filtered : sorted;
}

function getWeekFocusedRawText(scheduleText: string, currentWeek: number): string {
  return getBestWeekBlock(scheduleText, currentWeek).text.slice(0, 4000);
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
  if (words.length <= 10) return cleaned;
  return words.slice(0, 10).join(" ");
}

function isGenericPrimary(primary: string): boolean {
  const normalized = primary.trim().toLowerCase();
  if (!normalized) return true;
  return /^(no items|review|catch up|class|lecture|discussion|lab|work)$/.test(normalized);
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
    const secondary: string[] = [];
    const tagSet = new Set<string>(fromModel?.tags ?? []);

    const rowSignals: string[] = [];
    if (row?.lectureCell) {
      rowSignals.push(`Lecture: ${row.lectureCell}`);
      tagSet.add("lecture");
    }
    if (row?.discussionCell) {
      rowSignals.push(`Discussion: ${row.discussionCell}`);
      tagSet.add("discussion");
    }
    if (row?.labCell) {
      rowSignals.push(`Lab: ${row.labCell}`);
      tagSet.add("lab");
    }
    if (row?.quizCell && !/no\s+quiz/i.test(row.quizCell)) {
      rowSignals.push(`Quiz: ${row.quizCell}`);
      tagSet.add("quiz");
    }
    if (row?.sectionCell && /exam|midterm|final/i.test(row.sectionCell)) {
      rowSignals.push(`Exam: ${row.sectionCell}`);
      tagSet.add("exam");
    }
    if (row?.sectionCell && /homework|assignment|project|lab|due|submit/i.test(row.sectionCell)) {
      rowSignals.push(`Homework: ${row.sectionCell}`);
      tagSet.add("homework");
    }
    if (row?.notes && !/no\s+class/i.test(row.notes)) {
      rowSignals.push(row.notes);
    }

    if (!fromModel && row) {
      if (row.notes && /no\s+class|holiday|mlk\s+day/i.test(row.notes)) {
        primary = "No class";
        tagSet.add("no-class");
      } else if (rowSignals.length > 0) {
        primary = rowSignals[0];
      }
    }

    if (fromModel && rowSignals.length > 0) {
      if (isGenericPrimary(fromModel.primary) || /^no\s*items$/i.test(fromModel.primary)) {
        primary = rowSignals[0];
      }
      for (const signal of rowSignals) {
        if (signal.toLowerCase() === primary.toLowerCase()) continue;
        secondary.push(signal);
      }
    }

    const dedupedSecondary = Array.from(new Set(secondary.map((value) => value.trim()).filter(Boolean)));

    days.push({
      dateISO,
      dow: toDow(dateISO),
      primary: compactPrimary(primary),
      secondary: dedupedSecondary.length > 0 ? dedupedSecondary.slice(0, 3).map(compactPrimary) : undefined,
      tags: tagSet.size > 0 ? Array.from(tagSet) : undefined,
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

  const derived: WeekScheduleUpcoming[] = [];
  for (const day of params.days) {
    const candidates = [day.primary, ...(day.secondary ?? [])]
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value) => !/^no items$/i.test(value));

    const dueLike = candidates.filter((value) => /quiz|exam|midterm|final|homework|assignment|project|lab|due|submit/i.test(value));
    const source = dueLike.length > 0 ? dueLike : candidates;

    for (const title of source) {
      if (/^no class$/i.test(title)) continue;
      derived.push({
        title: compactPrimary(title),
        dueDateISO: day.dateISO,
        dueDowLabel: formatDueDowLabel(day.dateISO, params.weekStartISO, params.weekEndISO),
      });
    }
  }

  const dedupedDerived = Array.from(
    new Map(derived.map((item) => [`${item.dueDateISO}-${item.title.toLowerCase()}`, item])).values()
  );

  return [...items, ...dedupedDerived].slice(0, 3);
}

async function generateWeekScheduleFromStructuredInput(params: {
  currentWeek: number;
  weekStartISO: string;
  weekEndISO: string;
  weekRows: WeekRawRow[];
  weekRawText: string;
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

weekRawText snippet:
${params.weekRawText || "(none)"}

syllabusHints:
${params.syllabusHints || "(none)"}

Return JSON only.`;

  const completion = await groqClient.chat.completions.create({
    model: params.modelName,
    temperature: clampTemperature(SCHEDULE_TEMPERATURE, 0.15),
    max_completion_tokens: 900,
    ...(supportsReasoningEffort(params.modelName)
      ? { reasoning_effort: SCHEDULE_REASONING_EFFORT }
      : {}),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a schedule planner that converts structured weekly rows into dashboard-ready cards. You MUST return valid JSON only with no markdown or commentary. NEVER return an empty string.",
      },
      { role: "user", content: prompt },
    ],
  });

  const modelText = completion.choices[0]?.message?.content ?? "";
  const parsed = parseJsonObject(modelText);

  if (!parsed) {
    console.warn("[WeekSchedule] Groq returned invalid or empty JSON payload; using structured weekRows normalization.", {
      model: params.modelName,
      week: params.currentWeek,
      responseLength: modelText.length,
      responsePreview: modelText.slice(0, 300),
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

  const weekRows = extractWeekRows(resolved.scheduleText, week, { weekStartISO, weekEndISO });
  const weekRawText = getWeekFocusedRawText(resolved.scheduleText, week);
  const modelName = resolveGroqModel();

  const { days, upcoming } = await generateWeekScheduleFromStructuredInput({
    currentWeek: week,
    weekStartISO,
    weekEndISO,
    weekRows,
    weekRawText,
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
