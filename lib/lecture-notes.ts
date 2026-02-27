function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stripExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[•◦▪●]/g, "-")
    .replace(/[\t\u00A0]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function repairMergedWords(value: string) {
  return value
    .replace(/homogeneousequation/gi, "homogeneous equation")
    .replace(/tothis/gi, "to this")
    .replace(/generalsolution/gi, "general solution")
    .replace(/usingreduction/gi, "using reduction")
    .replace(/orderNagle/gi, "order Nagle")
    .replace(/Chapter\s*4\.7Friday/gi, "Chapter 4.7 Friday")
    .replace(/\s+,/g, ",");
}

function isLikelyNoise(line: string) {
  return (
    /^page\s+\d+/i.test(line) ||
    /^slide\s+\d+/i.test(line) ||
    /^\d+\s*\/\s*\d+$/i.test(line) ||
    /^https?:\/\//i.test(line)
  );
}

function isLikelyEquation(line: string) {
  if (!line.includes("=")) return false;
  if (line.length < 8 || line.length > 220) return false;
  if (/(find|verify|show|use|consider|problem|concept\s*check|now\s+find|the\s+following\s+equation)/i.test(line)) {
    return false;
  }

  const symbolCount = (line.match(/[=+\-*/^()]/g) ?? []).length;
  return symbolCount >= 3;
}

function isLikelyHeading(line: string) {
  if (line.length < 4 || line.length > 90) return false;
  if (/^(lecture|week|chapter|unit|topic|section)\s+\d+/i.test(line)) return true;
  if (/^[A-Z][A-Z\s\d:&()'\-]{3,}$/.test(line)) return true;
  if (/:$/.test(line)) return true;
  return false;
}

function splitIntoFragments(raw: string) {
  const seeded = raw
    .replace(/\s+(?=\d+\.)/g, "\n")
    .replace(/\s+(?=\(?[a-z]\)\s)/gi, "\n")
    .replace(/([.;!?])\s+(?=[A-Z])/g, "$1\n")
    .replace(/\s+(?=Use\s+)/g, "\n")
    .replace(/\s+(?=Verify\s+)/g, "\n")
    .replace(/\s+(?=Now\s+find\s+)/gi, "\n")
    .replace(/\s+(?=The\s+following\s+equation)/gi, "\n")
    .replace(/\s+(?=Concept\s+check)/gi, "\n")
    .replace(/(\d)\.(\d)([A-Z])/g, "$1.$2\n$3");

  return seeded
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .map((line) => repairMergedWords(line))
    .filter(Boolean);
}

function cleanLines(text: string) {
  return text
    .split(/\r?\n/)
    .flatMap(splitIntoFragments)
    .filter((line) => line.length >= 3)
    .filter((line) => !isLikelyNoise(line));
}

function dedupeLines(lines: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(line);
  }

  return output;
}

function looksLikeTask(line: string) {
  return /(find|solve|verify|show|use|determine|write|consider|prove|compute)/i.test(line);
}

function toLatexEquation(raw: string) {
  let value = raw;

  value = value
    .replace(/π/g, "\\pi")
    .replace(/≤/g, "\\le")
    .replace(/≥/g, "\\ge")
    .replace(/−/g, "-")
    .replace(/\bt2(?=\s*[a-zA-Z])/g, "t^2")
    .replace(/\by2(?=\s*[a-zA-Z])/g, "y^2")
    .replace(/\bpi2\b/gi, "\\pi^2")
    .replace(/\bin\s+an\s+interval\s+I\b/gi, "in\\ an\\ interval\\ I")
    .replace(/([a-zA-Z])''/g, "$1^{\\prime\\prime}")
    .replace(/([a-zA-Z])'/g, "$1^{\\prime}")
    .replace(/\b(sin|cos|tan|sec|csc|cot|log|ln|exp)\b/gi, "\\$1")
    .replace(/sec2\(([^)]+)\)/gi, "\\sec^2($1)")
    .replace(/cos2\(([^)]+)\)/gi, "\\cos^2($1)")
    .replace(/sin2\(([^)]+)\)/gi, "\\sin^2($1)")
    .replace(/\s{2,}/g, " ")
    .trim();

  return value;
}

function extractDateMention(lines: string[]) {
  const datePattern = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\s*(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+\d{4}\b/i;
  for (const line of lines) {
    const match = line.match(datePattern);
    if (match) return match[0].trim();
  }
  return null;
}

function extractGivenEquation(lines: string[]) {
  for (const line of lines) {
    const match = line.match(/[a-zA-Z0-9()\s^{}+\-*/\\]+=[a-zA-Z0-9()\s^{}+\-*/\\]+/);
    if (!match) continue;
    const candidate = match[0].trim();
    if (candidate.length < 10) continue;
    if (/(find|verify|show|use|consider|problem|concept\s*check)/i.test(line)) continue;
    return toLatexEquation(candidate);
  }
  return "";
}

function normalizeTaskText(line: string) {
  return line
    .replace(/^\d+(?:\.\d+)*\.?\s*/, "")
    .replace(/^\([a-z]\)\s*/i, "")
    .trim();
}

export function buildReadableLectureNote(params: {
  filename: string;
  extractedText: string;
}) {
  const sourceTitle = toTitleCase(stripExtension(params.filename).replace(/[_-]+/g, " "));
  const title = sourceTitle ? `Lecture Notes • ${sourceTitle}` : "Lecture Notes";

  const normalizedLines = dedupeLines(cleanLines(params.extractedText)).slice(0, 900);

  if (normalizedLines.length === 0) {
    return {
      title,
      content: "## Lecture Info\n\n- Source: No readable text extracted.",
    };
  }

  const equations = dedupeLines(normalizedLines.filter(isLikelyEquation)).map(toLatexEquation);
  const conceptChecks = dedupeLines(
    normalizedLines.filter((line) => /concept\s*check/i.test(line))
  );
  const taskCandidates = dedupeLines(
    normalizedLines
      .filter((line) => !isLikelyEquation(line))
      .filter((line) => looksLikeTask(line))
      .map(normalizeTaskText)
      .filter((line) => line.length >= 20)
  );

  const chapterLine = normalizedLines.find((line) => /chapter\s+\d+/i.test(line));
  const dateLine = extractDateMention(normalizedLines);
  const keyConceptLine =
    normalizedLines.find((line) => /reduction\s+of\s+order/i.test(line)) ??
    normalizedLines.find((line) => /linearly independent solution/i.test(line)) ??
    normalizedLines.find((line) => line.length >= 30);

  const givenEquation = extractGivenEquation(normalizedLines) || equations[0] || "";

  const theoremLines: string[] = [];
  if (/reduction\s+of\s+order/i.test(normalizedLines.join(" "))) {
    theoremLines.push(
      "For the linear homogeneous ODE $y^{\\prime\\prime}(t) + p(t)y^{\\prime}(t) + q(t)y(t) = 0$, if $y_1(t)$ is a known nonzero solution, a second linearly independent solution is:",
      "$$y_2(t)=y_1(t)\\int \\frac{e^{-\\int p(t)\\,dt}}{(y_1(t))^2}\\,dt.$$"
    );
  }

  const fallbackNotes = dedupeLines(
    normalizedLines
      .filter((line) => !looksLikeTask(line))
      .filter((line) => !/concept\s*check/i.test(line))
      .filter((line) => !isLikelyEquation(line))
      .filter((line) => !isLikelyHeading(line))
      .filter((line) => line.length >= 20)
      .slice(0, 6)
  );

  const content: string[] = [
    "## **Lecture Info**",
    "",
    `- **Source:** ${sourceTitle || params.filename}`,
    ...(chapterLine ? [`- **Reference:** ${chapterLine}`] : []),
    ...(dateLine ? [`- **Date Mentioned:** ${dateLine}`] : []),
    "",
    "## **Key Concept**",
    "",
    `- ${keyConceptLine ?? "Core concept extracted from lecture text."}`,
    "",
    "## **Theorem (if applicable)**",
    "",
    ...(theoremLines.length > 0 ? theoremLines : ["- No explicit theorem statement detected in the provided text."]),
    "",
    "## **Given Equation**",
    "",
    ...(givenEquation
      ? ["$$", givenEquation, "$$"]
      : ["- No clear primary equation detected."]),
    "",
    "## **Tasks / Problems**",
    "",
    ...(taskCandidates.length > 0
      ? taskCandidates.map((task, index) => `${index + 1}. ${task}`)
      : ["1. Review the lecture text and extract explicit tasks manually."]),
    "",
    "## **Key Equations**",
    "",
    ...(equations.length > 0 ? equations.map((eq) => `- $${eq}$`) : ["- No additional equations extracted."]),
    "",
    "## **Concept Checks**",
    "",
    ...(conceptChecks.length > 0
      ? conceptChecks.map((line) => `- ${line}`)
      : fallbackNotes.length > 0
      ? fallbackNotes.map((line) => `- ${line}`)
      : ["- No explicit concept-check prompt detected."]),
  ];

  return {
    title,
    content: content.join("\n"),
  };
}
