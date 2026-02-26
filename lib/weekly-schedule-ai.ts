import Groq from "groq-sdk";
import { unstable_cache } from "next/cache";
import { createHash } from "node:crypto";

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SCHEDULE_TEMPERATURE = Number.parseFloat(process.env.GROQ_SCHEDULE_TEMPERATURE ?? "0.15");
const SCHEDULE_REASONING_EFFORT =
  (process.env.GROQ_SCHEDULE_REASONING_EFFORT?.trim() || "low") as "none" | "low" | "medium" | "high";

function clampTemperature(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(2, Math.max(0, value));
}

function supportsReasoningEffort(modelName: string) {
  const normalized = modelName.toLowerCase();
  return normalized.includes("gpt-oss") || normalized.includes("qwen3") || normalized.includes("deepseek-r1");
}

export type ScheduleEntry = {
  date: string; // ISO 8601 format: YYYY-MM-DD
  dateLabel: string; // Human-readable: "Feb 23"
  events: string[]; // Array of event descriptions
};

export type WeeklyScheduleCachePayload = {
  version: 2;
  scheduleFingerprint: string;
  weeks: Record<string, WeeklyScheduleWeekCacheEntry>;
};

export type WeeklyScheduleWeekCacheEntry = {
  entries: ScheduleEntry[];
  generatedAt: string; // ISO timestamp
};

export type LegacyWeeklyScheduleCachePayload = {
  version: 1;
  scheduleFingerprint: string;
  weeks: Record<string, ScheduleEntry[]>;
};

function normalizeDateString(input: string): { iso: string; label: string } | null {
  const value = input.trim();
  if (!value) return null;

  const dayMonth = value.match(
    /^(\d{1,2})[\s\-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:,?\s*(\d{4}))?$/i
  );
  const monthDay = value.match(
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+|\-)(\d{1,2})(?:,?\s*(\d{4}))?$/i
  );

  const match = dayMonth ?? monthDay;
  if (!match) return null;

  const isDayMonth = !!dayMonth;
  const day = Number.parseInt(isDayMonth ? match[1] : match[2], 10);
  const monthStr = isDayMonth ? match[2] : match[1];
  const year = Number.parseInt(match[3] ?? String(new Date().getUTCFullYear()), 10);

  if (Number.isNaN(day) || Number.isNaN(year) || !monthStr) return null;

  const monthIndex = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ].findIndex((m) => m.toLowerCase() === monthStr.toLowerCase().slice(0, 3));

  if (monthIndex < 0) return null;

  const date = new Date(Date.UTC(year, monthIndex, day));
  if (isNaN(date.getTime())) return null;

  const iso = date.toISOString().split("T")[0];
  const label = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return { iso, label };
}

function cleanModelEventText(event: string): string {
  return event
    .replace(/\b\d{1,2}\s*[-/]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\b/gi, " ")
    .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSectionOnlyEvent(value: string): boolean {
  const compact = value.trim();
  return /^(?:ch\.?\s*)?\d+(?:\.\d+)?(?:\s*[-–&]\s*\d+(?:\.\d+)?)*$/i.test(compact);
}

export function isLowSignalSchedule(entries: ScheduleEntry[]): boolean {
  if (entries.length === 0) return true;
  const normalizedEvents = entries
    .flatMap((entry) => entry.events)
    .map((event) => event.trim().toLowerCase())
    .filter(Boolean);

  if (normalizedEvents.length === 0) return true;

  return normalizedEvents.every((event) =>
    /^(?:topic:\s*)?(?:lecture|discussion|quiz|review)$/.test(event) ||
    /^(?:lecture|discussion|quiz|review):\s*(?:lecture|discussion|quiz|review)$/.test(event)
  );
}

function ensureActivityPrefix(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "";

  const normalizedPrefixMatch = cleaned.match(
    /^(lecture|discussion|quiz|exam|homework|assignment|lab|project|review|reading|office hours|no class)\b\s*:\s*(.+)$/i
  );
  if (normalizedPrefixMatch) {
    const label = normalizedPrefixMatch[1].toLowerCase();
    const content = normalizedPrefixMatch[2].trim();
    if (!content) return "";
    const normalizedLabel = label === "assignment" || label === "lab" || label === "project"
      ? "Homework"
      : label === "office hours"
        ? "Discussion"
        : label.charAt(0).toUpperCase() + label.slice(1);
    return `${normalizedLabel}: ${content}`;
  }

  const withoutGenericPrefix = cleaned.replace(/^(topic|event)\b\s*:\s*/i, "").trim();
  if (!withoutGenericPrefix) return "";

  if (/\b(no lecture|no class|holiday|mlk day|canceled|cancelled)\b/i.test(withoutGenericPrefix)) {
    return "No class";
  }

  if (/\b(midterm|final|exam)\b/i.test(withoutGenericPrefix)) {
    return `Exam: ${withoutGenericPrefix}`;
  }

  if (/\bquiz\b/i.test(withoutGenericPrefix)) {
    return `Quiz: ${withoutGenericPrefix}`;
  }

  if (/\bdiscussion\b/i.test(withoutGenericPrefix)) {
    return `Discussion: ${withoutGenericPrefix}`;
  }

  if (/\b(homework|assignment|due|submit|submission|report|project|lab)\b/i.test(withoutGenericPrefix)) {
    return `Homework: ${withoutGenericPrefix}`;
  }

  if (isSectionOnlyEvent(withoutGenericPrefix)) {
    return `Lecture: Section ${withoutGenericPrefix}`;
  }

  return `Lecture: ${withoutGenericPrefix}`;
}

function normalizeEventLabel(event: string): string {
  const cleaned = cleanModelEventText(event);
  if (!cleaned) return "";
  if (/^(topic|event)\s*:/i.test(cleaned)) {
    const withoutGenericPrefix = cleaned.replace(/^(topic|event)\s*:/i, "").trim();
    return ensureActivityPrefix(withoutGenericPrefix);
  }
  return ensureActivityPrefix(cleaned);
}

function extractScheduleHeaderHint(scheduleText: string): string {
  const lines = scheduleText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headerLine = lines.find((line) =>
    /\b(lecture|discussion|quiz|exam|homework|assignment|section|date)\b/i.test(line)
  );

  return (headerLine ?? "").slice(0, 300);
}

function extractSyllabusHints(syllabusContext?: string): string {
  if (!syllabusContext) return "";

  const lines = syllabusContext
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) =>
      /\b(quiz|exam|midterm|final|discussion|lecture|attendance|homework|assignment|lab|project|reading|due)\b/i.test(line)
    )
    .slice(0, 12);

  return lines.join("\n").slice(0, 1800);
}

function inferColumnHints(scheduleText: string, syllabusContext?: string): string[] {
  const source = `${scheduleText}\n${syllabusContext ?? ""}`.toLowerCase();
  const hints: string[] = [];

  if (/\blecture\b/.test(source)) hints.push("lecture");
  if (/\bdiscussion\b/.test(source)) hints.push("discussion");
  if (/\bquiz\b/.test(source)) hints.push("quiz");
  if (/\bexam|midterm|final\b/.test(source)) hints.push("exam");
  if (/\bhomework|assignment|project|lab\b/.test(source)) hints.push("homework");

  return hints;
}

function parseStructuredScheduleFromModelText(text: string): ScheduleEntry[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const jsonArrayMatch = trimmed.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonArrayMatch) {
      try {
        parsed = JSON.parse(jsonArrayMatch[0]);
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }

  if (!Array.isArray(parsed) && parsed && typeof parsed === "object") {
    const objectParsed = parsed as Record<string, unknown>;
    if (Array.isArray(objectParsed.items)) {
      parsed = objectParsed.items;
    } else if (Array.isArray(objectParsed.entries)) {
      parsed = objectParsed.entries;
    } else if (Array.isArray(objectParsed.schedule)) {
      parsed = objectParsed.schedule;
    }
  }

  if (!Array.isArray(parsed)) return [];

  const entries: ScheduleEntry[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;

    const itemAny = item as Record<string, unknown>;
    
    // Try to extract date from standard and alternative field names
    let dateStr: string | null = null;
    for (const key of Object.keys(itemAny)) {
      const keyLower = key.toLowerCase();
      if (
        (keyLower.includes("date") || keyLower === "date" || keyLower.includes("day")) &&
        typeof itemAny[key] === "string"
      ) {
        dateStr = itemAny[key];
        break;
      }
    }

    // Try to extract events from standard and alternative field names
    let events: unknown[] | null = null;
    for (const key of Object.keys(itemAny)) {
      const keyLower = key.toLowerCase();
      if ((keyLower.includes("event") || keyLower === "events") && Array.isArray(itemAny[key])) {
        events = itemAny[key];
        break;
      }
    }
    
    // If no events array found, try to collect all string values as events
    if (!events || events.length === 0) {
      const eventCandidates: string[] = [];
      for (const [key, value] of Object.entries(itemAny)) {
        const keyLower = key.toLowerCase();
        if (keyLower === "date" || keyLower === "datelabel") continue;
        if (typeof value === "string" && value.trim().length > 2) {
          eventCandidates.push(value);
        } else if (Array.isArray(value)) {
          for (const v of value) {
            if (typeof v === "string" && v.trim().length > 2) {
              eventCandidates.push(v);
            }
          }
        }
      }
      events = eventCandidates.length > 0 ? eventCandidates : null;
    }

    if (!dateStr || typeof dateStr !== "string") continue;
    if (!events || !Array.isArray(events)) continue;

    const normalized = normalizeDateString(dateStr);
    if (!normalized) continue;

    const cleanEvents = events
      .filter((e): e is string => typeof e === "string")
      .map((e) => normalizeEventLabel(e))
      .filter((e) => e.length > 2);

    if (cleanEvents.length === 0) continue;

    entries.push({
      date: normalized.iso,
      dateLabel: normalized.label,
      events: cleanEvents,
    });
  }

  return entries;
}

function getGroqModelCandidates(): string[] {
  const envPrimary = process.env.GROQ_MODEL?.trim();
  const envSecondary = process.env.GROQ_FALLBACK_MODEL?.trim();
  const defaults = [
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "qwen/qwen3-32b",
  ];

  return Array.from(
    new Set([envPrimary, envSecondary, ...defaults].filter((value): value is string => !!value))
  );
}

async function runGroqExtractionAttempt(params: {
  modelName: string;
  classId: string;
  currentWeek: number;
  prompt: string;
}) {
  const completion = await groqClient.chat.completions.create({
    model: params.modelName,
    temperature: clampTemperature(SCHEDULE_TEMPERATURE, 0.15),
    max_completion_tokens: 900,
    ...(supportsReasoningEffort(params.modelName)
      ? { reasoning_effort: SCHEDULE_REASONING_EFFORT }
      : {}),
    messages: [
      {
        role: "system",
        content:
          "You are a precise schedule extractor. Return ONLY a valid JSON value that matches the requested schema with no markdown or commentary.",
      },
      { role: "user", content: params.prompt },
    ],
  });

  const modelText = completion.choices[0]?.message?.content ?? "";

  const parsed = parseStructuredScheduleFromModelText(modelText);
  const usable = parsed.length > 0 && !isLowSignalSchedule(parsed);

  console.log("[WeeklyScheduleAI] model attempt result", {
    classId: params.classId,
    week: params.currentWeek,
    model: params.modelName,
    responseLength: modelText.length,
    parsedCount: parsed.length,
    usable,
    responsePreview: modelText.slice(0, 300),
  });

  return { parsed, usable };
}

function normalizeScheduleTextForModel(text: string) {
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

function getWeekFocusedScheduleText(text: string, currentWeek: number) {
  const normalized = normalizeScheduleTextForModel(text);
  const markers = findWeekMarkers(normalized);

  if (markers.length === 0) {
    return normalized.slice(0, 18000);
  }

  const exactIndex = markers.findIndex((entry) => entry.week === currentWeek);
  const targetIndex =
    exactIndex >= 0
      ? exactIndex
      : markers.reduce((best, entry, idx) => {
          const bestDistance = Math.abs(markers[best].week - currentWeek);
          const distance = Math.abs(entry.week - currentWeek);
          return distance < bestDistance ? idx : best;
        }, 0);

  const start = Math.max(0, markers[targetIndex].index - 120);
  const nextMarkerIndex =
    targetIndex + 1 < markers.length ? markers[targetIndex + 1].index : normalized.length;
  const end = Math.min(normalized.length, nextMarkerIndex + 140);

  return normalized.slice(start, end).slice(0, 18000);
}

export async function generateWeeklyScheduleSummary(params: {
  classId?: string;
  scheduleText: string;
  currentWeek: number;
  syllabusContext?: string;
}): Promise<ScheduleEntry[]> {
  const { scheduleText, currentWeek, syllabusContext } = params;
  const classId = params.classId ?? "unknown";
  if (!scheduleText.trim()) return [];
  
  const normalizedScheduleText = normalizeScheduleTextForModel(scheduleText);
  const weekMarkers = findWeekMarkers(normalizedScheduleText);
  const hasExactWeek = weekMarkers.some((entry) => entry.week === currentWeek);
  const weekFocusedScheduleText = getWeekFocusedScheduleText(scheduleText, currentWeek);
  const promptSourceText = hasExactWeek
    ? weekFocusedScheduleText
    : `${weekFocusedScheduleText}\n\nFull schedule fallback context:\n${normalizedScheduleText.slice(0, 6000)}`;

  const compactSyllabus = (syllabusContext ?? "").slice(0, 5000);
  const syllabusHints = extractSyllabusHints(syllabusContext);
  const scheduleHeaderHint = extractScheduleHeaderHint(normalizedScheduleText);
  const columnHints = inferColumnHints(normalizedScheduleText, syllabusContext);
  const strictPrompt = `Extract all schedule items for week ${currentWeek}.

Required output format:
- JSON array of objects
- each object: { "date": "Month DD", "events": ["..."] }

Rules:
- Include only entries from week ${currentWeek}.
- Every event must be concise and human-friendly.
- Event style must match compact dashboard cards: 2-8 words, concise but specific.
- Use activity labels when inferable: "Lecture: ...", "Discussion: ...", "Quiz: ...", "Exam: ...", "Homework: ...".
- If only section numbers appear and the row structure implies multiple columns, map them by likely column semantics.
- Prefer preserving quiz/exam information over generic section-only labels.
- Prefer action-oriented phrases such as "Lecture + notes", "Start quiz prep", "Draft lab report", "Weekly review".
- If a row has lecture/discussion/quiz columns, convert each cell into a short phrase.
- Do not include raw date fragments inside event text.
- Do not include duplicate or near-duplicate events.
- Do not use labels like "Topic:" or "Event:" and do not return markdown.

Detected schedule header (if any):
${scheduleHeaderHint || "(none)"}

Detected activity hints:
${columnHints.length > 0 ? columnHints.join(", ") : "(none)"}

Schedule text:
${promptSourceText}

Syllabus/course context (optional):
${compactSyllabus}

High-signal syllabus hints:
${syllabusHints || "(none)"}

Return ONLY the JSON array.`;

  const compactPrompt = `Target week: ${currentWeek}

Extract only this week's schedule from the text below.
Output schema: [{"date":"Month DD","events":["..."]}]
Rules: compact event text, keep Lecture/Discussion/Quiz/Exam/Homework labels when inferable, no dates in events, no markdown.

Detected activity hints:
${columnHints.length > 0 ? columnHints.join(", ") : "(none)"}

Text:
${weekFocusedScheduleText}

Return only JSON array.`;

  console.log('[WeeklyScheduleAI] input analysis', {
    classId,
    week: currentWeek,
    scheduleTextLength: scheduleText.length,
    normalizedLength: normalizedScheduleText.length,
    weekFocusedLength: weekFocusedScheduleText.length,
    hasExactWeek,
    syllabusContextLength: syllabusContext?.length ?? 0,
    weekMarkersPreview: weekMarkers.slice(0, 12).map((entry) => entry.week),
    scheduleTextPreview: scheduleText.slice(0, 200),
    normalizedPreview: normalizedScheduleText.slice(0, 200),
    weekFocusedPreview: weekFocusedScheduleText.slice(0, 200),
    weekFocusedTailPreview: weekFocusedScheduleText.slice(-200),
  });

  try {
    console.log('[WeeklyScheduleAI] attempting groq extraction sequence');

    const models = getGroqModelCandidates();
    let bestNonEmpty: ScheduleEntry[] = [];

    for (const modelName of models) {
      const strictAttempt = await runGroqExtractionAttempt({
        modelName,
        classId,
        currentWeek,
        prompt: strictPrompt,
      });

      if (strictAttempt.usable) {
        return deduplicateScheduleEntries(strictAttempt.parsed).sort((a, b) => a.date.localeCompare(b.date));
      }

      if (strictAttempt.parsed.length > bestNonEmpty.length) {
        bestNonEmpty = strictAttempt.parsed;
      }

      const compactAttempt = await runGroqExtractionAttempt({
        modelName,
        classId,
        currentWeek,
        prompt: compactPrompt,
      });

      if (compactAttempt.usable) {
        return deduplicateScheduleEntries(compactAttempt.parsed).sort((a, b) => a.date.localeCompare(b.date));
      }

      if (compactAttempt.parsed.length > bestNonEmpty.length) {
        bestNonEmpty = compactAttempt.parsed;
      }
    }

    if (bestNonEmpty.length > 0) {
      console.log('[WeeklyScheduleAI] returning best non-empty groq output', {
        classId,
        week: currentWeek,
        parsedCount: bestNonEmpty.length,
      });
      return deduplicateScheduleEntries(bestNonEmpty).sort((a, b) => a.date.localeCompare(b.date));
    }

    console.error('[WeeklyScheduleAI] all groq attempts returned empty output', {
      classId,
      week: currentWeek,
      modelCandidates: models,
    });
    return [];
  } catch (err) {
    console.error('[WeeklyScheduleAI] error generating week items', {
      classId,
      week: currentWeek,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    console.error('[WeeklyScheduleAI] full error:', err);
    return [];
  }
}

export function deduplicateScheduleEntries(entries: ScheduleEntry[]): ScheduleEntry[] {
  const byDate = new Map<string, Set<string>>();
  
  for (const entry of entries) {
    if (!byDate.has(entry.date)) {
      byDate.set(entry.date, new Set());
    }
    const eventSet = byDate.get(entry.date)!;
    for (const event of entry.events) {
      eventSet.add(event);
    }
  }

  const result: ScheduleEntry[] = [];
  for (const [date, events] of byDate) {
    const entry = entries.find((e) => e.date === date);
    if (entry) {
      result.push({
        ...entry,
        events: Array.from(events),
      });
    }
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export function getScheduleFingerprint(scheduleText: string) {
  return createHash("sha256").update(scheduleText).digest("hex").slice(0, 16);
}

export function parseWeeklyScheduleCache(
  raw: string | null | undefined
): WeeklyScheduleCachePayload | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const payload = parsed as Partial<WeeklyScheduleCachePayload | LegacyWeeklyScheduleCachePayload>;
    if (payload.version !== 1 && payload.version !== 2) return null;
    if (typeof payload.scheduleFingerprint !== "string") return null;
    if (!payload.weeks || typeof payload.weeks !== "object") return null;

    const cleanedWeeks: Record<string, WeeklyScheduleWeekCacheEntry> = {};
    for (const [key, value] of Object.entries(payload.weeks)) {
      if (Array.isArray(value)) {
        const items = value.filter(
          (item): item is ScheduleEntry =>
            !!item &&
            typeof item === "object" &&
            typeof (item as ScheduleEntry).date === "string" &&
            typeof (item as ScheduleEntry).dateLabel === "string" &&
            Array.isArray((item as ScheduleEntry).events)
        );
        cleanedWeeks[key] = {
          entries: deduplicateScheduleEntries(items),
          generatedAt: new Date(0).toISOString(),
        };
        continue;
      }

      if (!value || typeof value !== "object") continue;
      const cacheItem = value as Partial<WeeklyScheduleWeekCacheEntry>;
      if (!Array.isArray(cacheItem.entries)) continue;

      const items = cacheItem.entries.filter(
        (item): item is ScheduleEntry =>
          !!item &&
          typeof item === "object" &&
          typeof (item as ScheduleEntry).date === "string" &&
          typeof (item as ScheduleEntry).dateLabel === "string" &&
          Array.isArray((item as ScheduleEntry).events)
      );

      cleanedWeeks[key] = {
        entries: deduplicateScheduleEntries(items),
        generatedAt:
          typeof cacheItem.generatedAt === "string" && cacheItem.generatedAt.trim().length > 0
            ? cacheItem.generatedAt
            : new Date(0).toISOString(),
      };
    }

    return {
      version: 2,
      scheduleFingerprint: payload.scheduleFingerprint,
      weeks: cleanedWeeks,
    };
  } catch {
    return null;
  }
}

export function buildWeeklyScheduleCache(params: {
  scheduleFingerprint: string;
  week: number;
  entries: ScheduleEntry[];
  generatedAt?: Date;
  existingRaw?: string | null;
}): WeeklyScheduleCachePayload {
  const existing = parseWeeklyScheduleCache(params.existingRaw ?? null);
  const weeks = existing?.scheduleFingerprint === params.scheduleFingerprint
    ? { ...existing.weeks }
    : {};

  weeks[String(params.week)] = {
    entries: deduplicateScheduleEntries(params.entries),
    generatedAt: (params.generatedAt ?? new Date()).toISOString(),
  };

  return {
    version: 2,
    scheduleFingerprint: params.scheduleFingerprint,
    weeks,
  };
}

function sanitizeCacheSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 32);
}

export async function getCachedWeeklyScheduleSummary(params: {
  classId: string;
  scheduleText: string;
  currentWeek: number;
  scheduleFingerprint: string;
  syllabusContext?: string;
}) {
  const contextFingerprint = getScheduleFingerprint(params.syllabusContext ?? "none");
  const cacheKey = [
    "v8",
    "weekly-schedule-ai",
    sanitizeCacheSegment(params.classId),
    `week-${params.currentWeek}`,
    `fp-${sanitizeCacheSegment(params.scheduleFingerprint)}`,
    `ctx-${sanitizeCacheSegment(contextFingerprint)}`,
  ];

  const cachedFn = unstable_cache(
    async () =>
      generateWeeklyScheduleSummary({
        classId: params.classId,
        scheduleText: params.scheduleText,
        currentWeek: params.currentWeek,
        syllabusContext: params.syllabusContext,
      }),
    cacheKey,
    { revalidate: 60 * 10 }
  );

  return cachedFn();
}
