import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { computeEffectiveCurrentWeek } from "@/lib/week-utils";
import { getOrCreateWeekScheduleForClass } from "@/lib/week-schedule-service";
import {
  curateResourcesFromWeeklyTopics,
  type CuratedResource,
  type WeeklyTopicSource,
} from "@/lib/lecture-resource-curator";

type WeekRecommendationRecordData = {
  classId: string;
  week: number;
  topicSource: WeeklyTopicSource;
  topicSummary: string;
  topics: string[];
  resources: CuratedResource[];
  generatedAtISO: string;
  scheduleFingerprint: string;
  syllabusFingerprint: string;
  model: string;
};

function resolveCuratorModel() {
  return (
    process.env.GROQ_RESOURCE_MODEL?.trim() ||
    process.env.GROQ_CHAT_MODEL?.trim() ||
    process.env.GROQ_MODEL?.trim() ||
    "llama-3.3-70b-versatile"
  );
}

function getFingerprint(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function isMissingWeekRecommendationTableError(error: unknown): boolean {
  const value = error as { code?: unknown; meta?: unknown } | null;
  if (!value || typeof value !== "object") return false;

  const code = typeof value.code === "string" ? value.code : "";
  if (code !== "P2021" && code !== "P2010") return false;

  const table =
    value.meta && typeof value.meta === "object"
      ? String((value.meta as { table?: unknown }).table ?? "")
      : "";

  if (String(table).toLowerCase().includes("weekrecommendation")) return true;

  const message = (value as { message?: unknown }).message;
  return typeof message === "string" && /weekrecommendation/i.test(message);
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

function getExactWeekBlock(text: string, week: number): string {
  const normalized = normalizeScheduleTextForModel(text);
  const markers = findWeekMarkers(normalized);
  const exactIndex = markers.findIndex((entry) => entry.week === week);

  if (exactIndex < 0) return "";

  const start = markers[exactIndex].index;
  const end = exactIndex + 1 < markers.length ? markers[exactIndex + 1].index : normalized.length;
  return normalized.slice(start, end);
}

function cleanTopicLine(line: string): string {
  return line
    .replace(/\b(?:week|wk)\s*\d{1,2}\b/gi, " ")
    .replace(/\b\d{1,2}\s*[-/]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\b/gi, " ")
    .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?\b/gi, " ")
    .replace(/[\t•·|]+/g, " ")
    .replace(/^[\-–—:;,.\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLowSignalTopic(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (/^(lecture|discussion|quiz|exam|review|reading|homework|assignment|lab|project|section)$/i.test(normalized)) {
    return true;
  }
  if (/^(no items|no class)$/i.test(normalized)) return true;
  if (/^\d+(?:\.\d+)?(?:\s*[-–&]\s*\d+(?:\.\d+)?)*$/.test(normalized)) return true;
  return false;
}

function dedupeTopics(topics: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of topics) {
    const cleaned = cleanTopicLine(raw);
    if (!cleaned || isLowSignalTopic(cleaned)) continue;

    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(cleaned.slice(0, 180));
    if (result.length >= 10) break;
  }

  return result;
}

function normalizeSectionToken(value: string): string {
  const token = value.trim().replace(/[^0-9.]/g, "");
  if (!token) return "";
  const parts = token.split(".").filter(Boolean);
  if (parts.length < 2) return "";
  return `${Number.parseInt(parts[0], 10)}.${parts.slice(1).join(".")}`;
}

function extractSectionTokens(value: string): string[] {
  const matches = value.match(/\b\d+(?:\.\d+)+\b/g) ?? [];
  const normalized = matches.map((token) => normalizeSectionToken(token)).filter(Boolean);
  return Array.from(new Set(normalized));
}

function buildSectionTitleMap(text: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!text) return map;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 8);

  const sectionTitleRegex = /(\d+(?:\.\d+)+)\s+([A-Za-z][A-Za-z0-9'(),:&\-\/. ]{3,120}?)(?=\s+\d{1,2}-[A-Za-z]{3}\b|\s+Sunday,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\b|\s+None\b|$)/g;

  for (const line of lines) {
    let match: RegExpExecArray | null;
    while ((match = sectionTitleRegex.exec(line)) !== null) {
      const sectionToken = normalizeSectionToken(match[1]);
      const sectionTitle = cleanTopicLine(match[2]);
      if (!sectionToken || !sectionTitle) continue;
      if (isLowSignalTopic(sectionTitle)) continue;

      if (!map.has(sectionToken) || (map.get(sectionToken)?.length ?? 0) < sectionTitle.length) {
        map.set(sectionToken, sectionTitle);
      }
    }
  }

  return map;
}

function contextualizeSectionTopics(params: {
  weekText: string | null;
  sectionTitleMap: Map<string, string>;
}): string[] {
  if (!params.weekText) return [];

  const sectionTokens = extractSectionTokens(params.weekText);
  const topics: string[] = [];

  for (const token of sectionTokens) {
    const title = params.sectionTitleMap.get(token);
    if (!title) continue;
    topics.push(`Section ${token}: ${title}`);
  }

  return dedupeTopics(topics);
}

function extractTopicsFromWeekBlock(text: string | null, week: number): string[] {
  if (!text) return [];

  const weekBlock = getExactWeekBlock(text, week);
  if (!weekBlock) return [];

  const lines = weekBlock
    .split(/\r?\n/)
    .map((line) => cleanTopicLine(line))
    .filter((line) => line.length >= 4 && line.length <= 180)
    .filter((line) => !/^date\b/i.test(line))
    .filter((line) => !/^(lecture|discussion|quiz|section|topic)\s*$/i.test(line));

  return dedupeTopics(lines);
}

function extractTopicsFromWeekScheduleDays(days: Array<{ primary: string }>): string[] {
  const topics = days
    .map((day) => day.primary.trim())
    .filter(Boolean)
    .filter((value) => !/^(no items|no class)$/i.test(value))
    .map((value) => value.replace(/^(lecture|discussion|quiz|exam|homework|reading|review)\s*:\s*/i, ""));

  return dedupeTopics(topics);
}

function normalizeResources(value: Prisma.JsonValue): CuratedResource[] {
  if (!Array.isArray(value)) return [];

  const result: CuratedResource[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;

    const title = String(row.title ?? "").trim();
    const type = String(row.type ?? "").trim();
    const source = String(row.source ?? "").trim();
    const url = String(row.url ?? "").trim();
    const summary = String(row.summary ?? "").trim();

    if (!title || !source || !url || !summary) continue;
    if (type !== "Article" && type !== "Video" && type !== "Course Notes") continue;

    result.push({ title, type, source, url, summary });
  }

  return result;
}

function normalizeStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
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
      title: true,
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

function pickTopicSource(params: {
  scheduleTopics: string[];
  syllabusTopics: string[];
}): { source: WeeklyTopicSource; topics: string[] } {
  const scheduleTopics = dedupeTopics(params.scheduleTopics);
  const syllabusTopics = dedupeTopics(params.syllabusTopics);

  if (syllabusTopics.length > 0) {
    return { source: "syllabus", topics: syllabusTopics };
  }

  if (scheduleTopics.length > 0) {
    return { source: "schedule", topics: scheduleTopics };
  }

  return { source: "combined", topics: [] };
}

export async function getOrCreateWeekRecommendationsForClass(params: {
  classId: string;
  userId: string;
  targetWeek?: number;
}): Promise<WeekRecommendationRecordData | null> {
  const resolved = await resolveClassTexts(params);
  if (!resolved?.classRecord) return null;

  const effectiveWeek = computeEffectiveCurrentWeek(resolved.classRecord, new Date());
  const requestedWeek = params.targetWeek ?? effectiveWeek ?? resolved.classRecord.currentWeek ?? 1;
  if (!requestedWeek || requestedWeek < 1) return null;

  const week = Math.min(20, requestedWeek);
  const scheduleFingerprint = getFingerprint(resolved.scheduleText ?? "none");
  const syllabusFingerprint = getFingerprint(resolved.syllabusText ?? "none");

  let existing:
    | {
        classId: string;
        week: number;
        topicSource: string;
        topicSummary: string;
        topics: Prisma.JsonValue;
        resources: Prisma.JsonValue;
        generatedAtISO: string;
        scheduleFingerprint: string;
        syllabusFingerprint: string;
        model: string;
      }
    | null = null;

  let canPersistWeekRecommendations = true;

  try {
    const rows = await prisma.$queryRaw<Array<{
      classId: string;
      week: number;
      topicSource: string;
      topicSummary: string;
      topics: Prisma.JsonValue;
      resources: Prisma.JsonValue;
      generatedAtISO: string;
      scheduleFingerprint: string;
      syllabusFingerprint: string;
      model: string;
    }>>(
      Prisma.sql`
        SELECT
          "classId",
          "week",
          "topicSource",
          "topicSummary",
          "topics",
          "resources",
          "generatedAtISO",
          "scheduleFingerprint",
          "syllabusFingerprint",
          "model"
        FROM "WeekRecommendation"
        WHERE "classId" = ${resolved.classRecord.id}
          AND "week" = ${week}
          AND "scheduleFingerprint" = ${scheduleFingerprint}
          AND "syllabusFingerprint" = ${syllabusFingerprint}
        ORDER BY "createdAt" DESC
        LIMIT 1
      `
    );

    existing = rows[0] ?? null;
  } catch (error) {
    if (isMissingWeekRecommendationTableError(error)) {
      canPersistWeekRecommendations = false;
      console.warn("[WeekRecommendation] WeekRecommendation table missing. Returning non-persistent recommendations.");
    } else {
      throw error;
    }
  }

  if (existing) {
    return {
      classId: existing.classId,
      week: existing.week,
      topicSource: (existing.topicSource as WeeklyTopicSource) || "combined",
      topicSummary: existing.topicSummary,
      topics: normalizeStringArray(existing.topics),
      resources: normalizeResources(existing.resources),
      generatedAtISO: existing.generatedAtISO,
      scheduleFingerprint: existing.scheduleFingerprint,
      syllabusFingerprint: existing.syllabusFingerprint,
      model: existing.model,
    };
  }

  const weekSchedule = await getOrCreateWeekScheduleForClass({
    classId: params.classId,
    userId: params.userId,
    targetWeek: week,
  });

  const scheduleWeekBlock = resolved.scheduleText ? getExactWeekBlock(resolved.scheduleText, week) : "";
  const scheduleSectionTitleMap = buildSectionTitleMap(resolved.scheduleText);

  const scheduleTopicsFromDays = extractTopicsFromWeekScheduleDays(weekSchedule?.days ?? []);
  const scheduleTopicsFromText = extractTopicsFromWeekBlock(resolved.scheduleText, week);
  const scheduleTopicsFromSections = contextualizeSectionTopics({
    weekText: scheduleWeekBlock,
    sectionTitleMap: scheduleSectionTitleMap,
  });
  const syllabusTopicsFromText = extractTopicsFromWeekBlock(resolved.syllabusText, week);

  const selectedTopics = pickTopicSource({
    scheduleTopics: [...scheduleTopicsFromDays, ...scheduleTopicsFromText, ...scheduleTopicsFromSections],
    syllabusTopics: syllabusTopicsFromText,
  });

  if (selectedTopics.topics.length === 0) return null;

  const payload = await curateResourcesFromWeeklyTopics({
    classTitle: resolved.classRecord.title,
    week,
    topicSource: selectedTopics.source,
    topics: selectedTopics.topics,
  });

  const generatedAtISO = new Date().toISOString();
  const model = resolveCuratorModel();
  const topicSummary = payload.concept_title || selectedTopics.topics[0] || "";

  if (!canPersistWeekRecommendations) {
    return {
      classId: resolved.classRecord.id,
      week,
      topicSource: selectedTopics.source,
      topicSummary,
      topics: selectedTopics.topics,
      resources: payload.resources,
      generatedAtISO,
      scheduleFingerprint,
      syllabusFingerprint,
      model,
    };
  }

  try {
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "WeekRecommendation" (
          "id",
          "classId",
          "week",
          "topicSource",
          "topicSummary",
          "topics",
          "resources",
          "generatedAtISO",
          "scheduleFingerprint",
          "syllabusFingerprint",
          "model",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${randomUUID()},
          ${resolved.classRecord.id},
          ${week},
          ${selectedTopics.source},
          ${topicSummary},
          ${JSON.stringify(selectedTopics.topics)}::jsonb,
          ${JSON.stringify(payload.resources)}::jsonb,
          ${generatedAtISO},
          ${scheduleFingerprint},
          ${syllabusFingerprint},
          ${model},
          NOW(),
          NOW()
        )
        ON CONFLICT ("classId", "week", "scheduleFingerprint", "syllabusFingerprint") DO NOTHING
      `
    );
  } catch (error) {
    if (!isMissingWeekRecommendationTableError(error)) {
      throw error;
    }
  }

  return {
    classId: resolved.classRecord.id,
    week,
    topicSource: selectedTopics.source,
    topicSummary,
    topics: selectedTopics.topics,
    resources: payload.resources,
    generatedAtISO,
    scheduleFingerprint,
    syllabusFingerprint,
    model,
  };
}
