"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SemesterWeekVerifier from "./SemesterWeekVerifier";

type UploadResult = {
  name: string;
  ok: boolean;
  error?: string;
  key: string;
  documentId?: string;
  status?: string;
  docType?: "syllabus" | "schedule" | "other";
};

type UploadPhase = "idle" | "uploading" | "extracting" | "refreshing";

function formatFileCount(files: File[]) {
  if (files.length === 0) return "No Files Selected";
  if (files.length === 1) return files[0].name;
  return `${files.length} Files Selected`;
}

function inferDocTypeFromFilename(file: File): "syllabus" | "schedule" | "other" {
  const name = file.name.toLowerCase();
  if (name.includes("syllabus")) return "syllabus";
  if (
    name.includes("schedule") ||
    name.includes("calendar") ||
    name.includes("week") ||
    name.includes("timetable")
  ) {
    return "schedule";
  }
  return "other";
}

function formatExtractionStatus(status?: string) {
  if (!status) return "Waiting for extraction";

  if (status === "pending") return "Queued for extraction";
  if (status === "processing") return "Extracting text";
  if (status === "done") return "Extraction complete";
  if (status === "failed") return "Extraction failed";

  return status;
}

export default function ClassDocumentUploader({ classId }: { classId: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [results, setResults] = useState<UploadResult[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [documentStatuses, setDocumentStatuses] = useState<Record<string, string>>({});
  const [latestUploadIds, setLatestUploadIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showVerifier, setShowVerifier] = useState(false);

  const summary = useMemo(() => formatFileCount(files), [files]);
  const canSubmit = files.length > 0 && phase === "idle";

  const uploadProgress = useMemo(() => {
    if (phase !== "uploading" || files.length === 0) return 0;
    const values = files.map((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      return progress[key] ?? 0;
    });
    const total = values.reduce((sum, value) => sum + value, 0);
    return Math.round(total / values.length);
  }, [files, phase, progress]);

  const extractionProgress = useMemo(() => {
    const successResults = results.filter((item) => item.ok && item.documentId);
    if (!successResults.length) return { done: 0, total: 0, percent: 0 };

    const done = successResults.filter((item) => {
      const status = item.documentId ? documentStatuses[item.documentId] : undefined;
      return status === "done" || status === "failed";
    }).length;

    return {
      done,
      total: successResults.length,
      percent: Math.round((done / successResults.length) * 100),
    };
  }, [documentStatuses, results]);

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitForExtraction = async (documentIds: string[]) => {
    if (!documentIds.length) return;

    setPhase("extracting");

    const timeoutMs = 45_000;
    const intervalMs = 1_250;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const response = await fetch(`/api/documents?classId=${encodeURIComponent(classId)}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Could not check extraction progress");
      }

      const payload = await response.json();
      const docs: Array<{ id?: string; status?: string }> = Array.isArray(payload?.documents)
        ? payload.documents
        : [];

      const nextStatuses = docs.reduce((acc: Record<string, string>, doc) => {
        if (doc?.id && typeof doc?.status === "string") {
          acc[doc.id] = doc.status;
        }
        return acc;
      }, {});

      setDocumentStatuses(nextStatuses);

      const allFinished = documentIds.every((id) => {
        const status = nextStatuses[id];
        return status === "done" || status === "failed";
      });

      if (allFinished) {
        return;
      }

      await wait(intervalMs);
    }

    throw new Error("Extraction is taking longer than expected. You can refresh in a few seconds.");
  };

  const uploadFile = (file: File, key: string) =>
    new Promise<UploadResult>((resolve) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("classId", classId);
      formData.append("docType", inferDocTypeFromFilename(file));

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/documents");

      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        setProgress((prev) => ({ ...prev, [key]: percent }));
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          let docType: UploadResult["docType"];
          let documentId: string | undefined;
          let status: string | undefined;
          try {
            const payload = JSON.parse(xhr.responseText || "{}");
            docType = payload?.document?.docType;
            documentId = payload?.document?.id;
            status = payload?.document?.status;
          } catch {
            docType = undefined;
          }
          setProgress((prev) => ({ ...prev, [key]: 100 }));
          resolve({ name: file.name, ok: true, key, documentId, status, docType });
          return;
        }

        let errorMessage = "Upload failed";
        try {
          const payload = JSON.parse(xhr.responseText || "{}");
          errorMessage = payload?.error || errorMessage;
        } catch {
          // Ignore JSON parse failures.
        }
        resolve({ name: file.name, ok: false, error: errorMessage, key });
      });

      xhr.addEventListener("error", () => {
        resolve({ name: file.name, ok: false, error: "Upload failed", key });
      });

      xhr.send(formData);
    });

  const handleUpload = async () => {
    if (!canSubmit) return;

    setPhase("uploading");
    setError(null);
    setResults([]);
    setProgress({});
    setDocumentStatuses({});
    setLatestUploadIds([]);

    const uploads = files.map((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      setProgress((prev) => ({ ...prev, [key]: 0 }));
      return uploadFile(file, key);
    });

    const nextResults = await Promise.all(uploads);
    setResults(nextResults);

    const hasFailure = nextResults.some((item) => !item.ok);
    const uploadedFiles = [...files];
    setFiles([]);

    const successfulIds = nextResults
      .filter((item) => item.ok && item.documentId)
      .map((item) => item.documentId as string);
    setLatestUploadIds(successfulIds);

    const isScheduleUpload = nextResults.some(
      (item) => item.ok && item.docType === "schedule"
    ) || uploadedFiles.some((file) => inferDocTypeFromFilename(file) === "schedule");

    if (hasFailure) {
      setError("Some files failed to upload. Successful files will keep processing.");
    }

    try {
      await waitForExtraction(successfulIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction is still running. Please refresh shortly.");
    }

    if (isScheduleUpload) {
      setPhase("idle");
      setShowVerifier(true);
      return;
    }

    setPhase("refreshing");
    router.refresh();
    setPhase("idle");
  };

  const handleVerifySemester = async (currentWeek: number) => {
    try {
      if (latestUploadIds.length) {
        try {
          await waitForExtraction(latestUploadIds);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Extraction is still running. Please refresh shortly.");
        }
      }

      const response = await fetch("/api/classes", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classId,
          currentWeek,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to save semester info");
      }

      setShowVerifier(false);
      setPhase("refreshing");
      router.refresh();
      setPhase("idle");
    } catch (err) {
      setPhase("idle");
      throw err;
    }
  };

  const phaseMessage =
    phase === "uploading"
      ? `Uploading files (${uploadProgress}%)`
      : phase === "extracting"
      ? `Extracting document text (${extractionProgress.done}/${extractionProgress.total})`
      : phase === "refreshing"
      ? "Finalizing and refreshing"
      : null;

  return (
    <>
      <div className="rounded-3xl bg-[color:var(--app-surface)] p-5 ring-1 ring-[color:var(--app-border)] shadow-[var(--app-shadow)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-[color:var(--app-text)]">
            Add Documents
          </div>
          <div className="mt-1 text-xs text-[color:var(--app-subtle)]">
            Upload Additional Syllabi, Schedules, Or Handouts.
          </div>
        </div>
        <div className="text-xs text-[color:var(--app-subtle)]">{summary}</div>
      </div>

      <label className="mt-4 block cursor-pointer rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-panel)] p-6 text-center text-sm text-[color:var(--app-subtle)] transition hover:border-[color:var(--app-text)]">
        <input
          type="file"
          className="sr-only"
          accept=".pdf,.docx,.doc"
          multiple
          onChange={(e) => {
            const incoming = Array.from(e.target.files ?? []);
            setFiles(incoming);
          }}
        />
        <div className="font-medium text-[color:var(--app-text)]">
          Drag And Drop Files Here
        </div>
        <div className="mt-1 text-xs text-[color:var(--app-subtle)]">
          Or Click To Browse
        </div>
      </label>

      {files.length ? (
        <div className="mt-4 rounded-2xl bg-[color:var(--app-panel)] p-4 ring-1 ring-[color:var(--app-border)]">
          <div className="text-xs font-medium text-[color:var(--app-text)]">Selected</div>
          <ul className="mt-2 space-y-1 text-xs text-[color:var(--app-subtle)]">
            {files.map((file) => {
              const key = `${file.name}-${file.size}-${file.lastModified}`;
              const fileProgress = progress[key];
              return (
                <li key={key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span>{file.name}</span>
                    <span className="text-[11px] text-[color:var(--app-muted)]">
                      {typeof fileProgress === "number" ? `${fileProgress}%` : ""}
                    </span>
                  </div>
                  {typeof fileProgress === "number" ? (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--app-border)]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-indigo-300 transition"
                        style={{ width: `${fileProgress}%` }}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="mt-3 text-xs text-cyan-400 hover:text-cyan-300"
            onClick={() => setFiles([])}
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleUpload}
          disabled={!canSubmit}
          className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {phase === "uploading"
            ? "Uploading..."
            : phase === "extracting"
            ? "Extracting..."
            : phase === "refreshing"
            ? "Refreshing..."
            : "Upload Documents"}
        </button>
        <div className="text-[11px] text-[color:var(--app-subtle)]">
          Max File Size 10MB. PDF Or Word Docs Only.
        </div>
      </div>

      {phaseMessage ? (
        <div className="mt-4 rounded-2xl bg-[color:var(--app-panel)] p-3 text-xs text-[color:var(--app-subtle)] ring-1 ring-[color:var(--app-border)]">
          <div className="font-medium text-[color:var(--app-text)]">Processing Status</div>
          <div className="mt-1">{phaseMessage}</div>
          {phase === "uploading" ? (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--app-border)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-indigo-300 transition"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          ) : null}
          {phase === "extracting" && extractionProgress.total > 0 ? (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--app-border)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-300 to-violet-300 transition"
                style={{ width: `${extractionProgress.percent}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl bg-red-500/10 p-3 text-xs text-red-300 ring-1 ring-red-500/20">
          {error}
        </div>
      ) : null}

      {results.length ? (
        <div className="mt-4 rounded-2xl bg-[color:var(--app-panel)] p-4 ring-1 ring-[color:var(--app-border)]">
          <div className="text-xs font-medium text-[color:var(--app-text)]">Upload Status</div>
          <ul className="mt-2 space-y-1 text-xs text-[color:var(--app-subtle)]">
            {results.map((result) => (
              <li key={result.key}>
                {result.ok ? "Uploaded" : "Failed"}: {result.name}
                {result.error ? ` (${result.error})` : ""}
                {result.ok
                  ? ` • ${formatExtractionStatus(
                      result.documentId ? documentStatuses[result.documentId] ?? result.status : result.status
                    )}`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      </div>

      <SemesterWeekVerifier
        isOpen={showVerifier}
        onVerify={handleVerifySemester}
      />
    </>
  );
}
