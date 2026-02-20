import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { unstable_cache } from "next/cache";
import { createHash } from "node:crypto";

function parseStringArrayFromModelText(text: string): string[] {
  const raw = text.trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const jsonArrayMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonArrayMatch) {
      parsed = JSON.parse(jsonArrayMatch[0]);
    } else {
      const objectMatch = raw.match(/\{[\s\S]*\}/);
      if (!objectMatch) {
        const fallbackLines = raw
          .split(/\r?\n/)
          .map((line) => line.replace(/^[-*\d.\s)]+/, "").trim())
          .filter(Boolean)
          .slice(0, 8);
        return fallbackLines;
      }
      parsed = JSON.parse(objectMatch[0]);
    }
  }

  if (!Array.isArray(parsed) && parsed && typeof parsed === "object") {
    const fromItems = (parsed as { items?: unknown }).items;
    if (Array.isArray(fromItems)) {
      parsed = fromItems;
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
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

function getWeekFocusedScheduleText(text: string, currentWeek: number) {
  const normalized = normalizeScheduleTextForModel(text);
  const marker = new RegExp(`\\bWeek\\s*${currentWeek}\\b`, "i");
  const match = marker.exec(normalized);
  if (!match) return normalized.slice(0, 18000);

  const start = Math.max(0, match.index - 700);
  const after = normalized.slice(match.index + match[0].length);
  const nextWeekMatch = after.match(/\bWeek\s*\d{1,2}\b/i);
  const end = nextWeekMatch
    ? Math.min(
        normalized.length,
        match.index + match[0].length + (nextWeekMatch.index ?? 0) + 900
      )
    : Math.min(normalized.length, match.index + 2600);

  return normalized.slice(start, end);
}

function getCompactWeekChunk(text: string, currentWeek: number) {
  const normalized = normalizeScheduleTextForModel(text);
  const marker = new RegExp(`\\bWeek\\s*${currentWeek}(?:\\b|\\s)`, "i");
  const match = marker.exec(normalized);

  if (!match) {
    return normalized.slice(0, 1400);
  }

  const after = normalized.slice(match.index + match[0].length);
  const nextWeekMatch = after.match(/\bWeek\s*\d{1,2}(?:\b|\s)/i);
  const end = nextWeekMatch
    ? match.index + match[0].length + (nextWeekMatch.index ?? 0)
    : Math.min(normalized.length, match.index + 900);

  return normalized.slice(match.index, end).slice(0, 1400);
}

export async function generateWeeklyScheduleSummary(params: {
  scheduleText: string;
  currentWeek: number;
  semester?: string | null;
}): Promise<string[]> {
  const { scheduleText, currentWeek, semester } = params;
  if (!scheduleText.trim()) return [];
  const normalizedScheduleText = normalizeScheduleTextForModel(scheduleText);
  const weekFocusedScheduleText = getWeekFocusedScheduleText(scheduleText, currentWeek);
  const compactWeekChunk = getCompactWeekChunk(scheduleText, currentWeek);

  try {
    const weekMatchResult = await generateText({
      model: groq("openai/gpt-oss-120b"),
      temperature: 0.2,
      maxOutputTokens: 600,
      system:
        "You extract week-specific class schedule details from noisy OCR/PDF text. The text may be merged into long lines and contain table artifacts.",
      prompt: `Semester: ${semester ?? "Unknown"}\nTarget week: ${currentWeek}\n\nWeek-focused schedule text:\n${weekFocusedScheduleText}\n\nFull normalized schedule text (for fallback context):\n${normalizedScheduleText.slice(0, 18000)}\n\nInstructions:\n1) Find all content for the target week number (e.g., 'Week ${currentWeek}', 'Wk ${currentWeek}').\n2) OCR may merge tokens like 'Week ${currentWeek}12-Feb'; treat that as week header + date.\n3) If explicit week headers are noisy/merged, infer entries nearest to that week block and matching dates/lectures/discussions/quizzes/exams/homework for that week.\n4) Prefer actionable items: class topics, quiz/exam events, homework due notices, cancellations (e.g., no lecture).\n5) De-duplicate aggressively and keep each item concise.\n\nOutput format requirements:\n- Return ONLY a strict JSON array of strings.\n- Max 10 items.\n- No markdown.\n- No prose outside JSON.`,
    });

    const primaryItems = parseStringArrayFromModelText(weekMatchResult.text);
    if (primaryItems.length > 0) {
      return primaryItems;
    }

    const inferredWeekResult = await generateText({
      model: groq("openai/gpt-oss-120b"),
      temperature: 0.1,
      maxOutputTokens: 600,
      system:
        "You infer likely current-week class schedule items from a full course schedule when week headers are unclear or missing.",
      prompt: `Semester: ${semester ?? "Unknown"}\nCurrent week number: ${currentWeek}\n\nWeek-focused schedule text:\n${weekFocusedScheduleText}\n\nFull normalized schedule text:\n${normalizedScheduleText.slice(0, 18000)}\n\nTask:\nInfer what belongs in the current week by scanning dates, lecture sequence, and nearby timeline markers. If exact week labels are missing, use the closest timeline evidence and provide best-effort items.\n\nInclude only actionable schedule items such as:\n- lecture/discussion topics\n- quizzes/exams\n- assignment or homework due notes\n- cancellations/holidays\n\nOutput rules:\n- Return ONLY a strict JSON array of strings\n- 0 to 8 items\n- Keep each item concise\n- No markdown, no extra text`,
    });

    const inferredItems = parseStringArrayFromModelText(inferredWeekResult.text);
    if (inferredItems.length > 0) {
      return inferredItems;
    }

    const conciseFallbackResult = await generateText({
      model: groq("openai/gpt-oss-120b"),
      temperature: 0,
      maxOutputTokens: 240,
      system: "Extract current-week course schedule items from short OCR text.",
      prompt: `Current week: ${currentWeek}\nSemester: ${semester ?? "Unknown"}\n\nSchedule snippet:\n${compactWeekChunk}\n\nReturn ONLY a JSON array of short strings with week-${currentWeek} items. If nothing is present, return [].`,
    });

    return parseStringArrayFromModelText(conciseFallbackResult.text);
  } catch {
    return [];
  }
}

export function getScheduleFingerprint(scheduleText: string) {
  return createHash("sha256").update(scheduleText).digest("hex").slice(0, 16);
}

function sanitizeCacheSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 32);
}

export async function getCachedWeeklyScheduleSummary(params: {
  classId: string;
  scheduleText: string;
  currentWeek: number;
  semester?: string | null;
  scheduleFingerprint: string;
}) {
  const cacheKey = [
    "v5",
    "weekly-schedule-ai",
    sanitizeCacheSegment(params.classId),
    `week-${params.currentWeek}`,
    `sem-${sanitizeCacheSegment(params.semester ?? "unknown")}`,
    `fp-${sanitizeCacheSegment(params.scheduleFingerprint)}`,
  ];

  const cachedFn = unstable_cache(
    async () =>
      generateWeeklyScheduleSummary({
        scheduleText: params.scheduleText,
        currentWeek: params.currentWeek,
        semester: params.semester,
      }),
    cacheKey,
    { revalidate: 60 * 60 * 24 }
  );

  return cachedFn();
}
