import Groq from "groq-sdk";

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
const RESOURCE_TEMPERATURE = Number.parseFloat(process.env.GROQ_RESOURCE_TEMPERATURE ?? "0.2");
const RESOURCE_REASONING_EFFORT =
  (process.env.GROQ_RESOURCE_REASONING_EFFORT?.trim() || "low") as "none" | "low" | "medium" | "high";

const ALLOWED_RESOURCE_TYPES = new Set(["Article", "Video", "Course Notes"]);

const TRUSTED_HOST_PATTERNS = [
  /(^|\.)ocw\.mit\.edu$/i,
  /(^|\.)khanacademy\.org$/i,
  /(^|\.)tutorial\.math\.lamar\.edu$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)youtu\.be$/i,
  /(^|\.)openstax\.org$/i,
  /(^|\.)math\.princeton\.edu$/i,
  /(^|\.)math\.berkeley\.edu$/i,
  /(^|\.)math\.stanford\.edu$/i,
  /(^|\.)harvard\.edu$/i,
  /(^|\.)edu$/i,
];

function clampTemperature(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(2, Math.max(0, value));
}

function supportsReasoningEffort(modelName: string) {
  const normalized = modelName.toLowerCase();
  return normalized.includes("gpt-oss") || normalized.includes("qwen3") || normalized.includes("deepseek-r1");
}

function resolveResourceModel() {
  return (
    process.env.GROQ_RESOURCE_MODEL?.trim() ||
    process.env.GROQ_CHAT_MODEL?.trim() ||
    process.env.GROQ_MODEL?.trim() ||
    "llama-3.3-70b-versatile"
  );
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

function normalizeSentenceCount(summary: string) {
  const cleaned = summary.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const sentenceParts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentenceParts.length <= 3) {
    return cleaned.slice(0, 420);
  }

  return sentenceParts.slice(0, 3).join(" ").slice(0, 420);
}

function isTrustedUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return TRUSTED_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname));
  } catch {
    return false;
  }
}

export type CuratedResource = {
  title: string;
  type: "Article" | "Video" | "Course Notes";
  source: string;
  url: string;
  summary: string;
};

export type CuratedResourcePayload = {
  concept_title: string;
  resources: CuratedResource[];
};

function normalizePayload(payload: Record<string, unknown>): CuratedResourcePayload {
  const conceptTitle =
    typeof payload.concept_title === "string" && payload.concept_title.trim().length > 0
      ? payload.concept_title.trim().slice(0, 180)
      : "";

  const resourcesRaw = Array.isArray(payload.resources) ? payload.resources : [];
  const resources: CuratedResource[] = [];
  const seenUrls = new Set<string>();

  for (const item of resourcesRaw) {
    if (!item || typeof item !== "object") continue;

    const value = item as Record<string, unknown>;
    const title = String(value.title ?? "").trim();
    const type = String(value.type ?? "").trim();
    const source = String(value.source ?? "").trim();
    const url = String(value.url ?? "").trim();
    const summary = normalizeSentenceCount(String(value.summary ?? ""));

    if (!title || !source || !summary) continue;
    if (!ALLOWED_RESOURCE_TYPES.has(type)) continue;
    if (!isTrustedUrl(url)) continue;

    const dedupeKey = url.toLowerCase();
    if (seenUrls.has(dedupeKey)) continue;
    seenUrls.add(dedupeKey);

    resources.push({
      title: title.slice(0, 180),
      type: type as CuratedResource["type"],
      source: source.slice(0, 120),
      url,
      summary,
    });

    if (resources.length === 3) break;
  }

  if (resources.length !== 3) {
    return {
      concept_title: conceptTitle,
      resources: [],
    };
  }

  return {
    concept_title: conceptTitle,
    resources,
  };
}

function buildLectureNotesSnippet(notes: string[]) {
  return notes
    .map((note, index) => {
      const snippet = note
        .replace(/\u0000/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 9000);

      return `Lecture Note ${index + 1}:\n${snippet}`;
    })
    .join("\n\n---\n\n")
    .slice(0, 22000);
}

export async function curateResourcesFromLectureNotes(params: {
  classTitle?: string;
  lectureNoteTexts: string[];
}): Promise<CuratedResourcePayload> {
  const notes = params.lectureNoteTexts.map((value) => value.trim()).filter(Boolean);
  if (notes.length === 0) {
    return { concept_title: "", resources: [] };
  }

  const model = resolveResourceModel();
  const notesContext = buildLectureNotesSnippet(notes);

  const prompt = `You are an academic resource curator.

Task:
Given lecture notes uploaded by a student, identify the primary key concept title and recommend exactly 3 high-quality external learning resources.

Rules:
- Use the primary concept from the lecture notes as the search anchor.
- This must work for any class subject (math, science, humanities, business, etc.).
- Prioritize reputable educational sources such as MIT OCW, Khan Academy, Paul's Online Math Notes, university lecture notes (.edu), textbook companion sites, and YouTube lectures from professors.
- Avoid random blogs, low-quality sources, and unclear domains.
- Ensure links are realistic, valid-looking HTTPS URLs.
- Provide concise student-friendly summaries (2-3 sentences max).
- Do not invent fake platforms.

Output format requirements:
- Return JSON only with keys: concept_title, resources.
- resources must contain exactly 3 items.
- Each resource item must include: title, type, source, url, summary.
- type must be one of: Article | Video | Course Notes.
- If you cannot confidently provide 3 quality resources, return resources as an empty array.

Class title: ${params.classTitle?.trim() || "(unknown)"}

Lecture notes:
${notesContext}`;

  try {
    const completion = await groqClient.chat.completions.create({
      model,
      temperature: clampTemperature(RESOURCE_TEMPERATURE, 0.2),
      max_completion_tokens: 1300,
      ...(supportsReasoningEffort(model)
        ? { reasoning_effort: RESOURCE_REASONING_EFFORT }
        : {}),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a strict JSON generator. Return only a valid JSON object with no markdown, commentary, or extra keys.",
        },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = parseJsonObject(raw);
    if (!parsed) {
      return { concept_title: "", resources: [] };
    }

    return normalizePayload(parsed);
  } catch (error) {
    console.error("[ResourceCurator] Failed to generate resources:", error);
    return { concept_title: "", resources: [] };
  }
}
