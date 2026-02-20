"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SemesterWeekVerifier from "./SemesterWeekVerifier";

type UploadResult = {
  name: string;
  ok: boolean;
  error?: string;
  key: string;
  docType?: "syllabus" | "schedule" | "other";
};

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

export default function ClassDocumentUploader({ classId }: { classId: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [showVerifier, setShowVerifier] = useState(false);

  const summary = useMemo(() => formatFileCount(files), [files]);
  const canSubmit = files.length > 0 && !isUploading;

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
          try {
            const payload = JSON.parse(xhr.responseText || "{}");
            docType = payload?.document?.docType;
          } catch {
            docType = undefined;
          }
          setProgress((prev) => ({ ...prev, [key]: 100 }));
          resolve({ name: file.name, ok: true, key, docType });
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

    setIsUploading(true);
    setError(null);
    setResults([]);
    setProgress({});

    const uploads = files.map((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      setProgress((prev) => ({ ...prev, [key]: 0 }));
      return uploadFile(file, key);
    });

    const nextResults = await Promise.all(uploads);
    setResults(nextResults);
    setIsUploading(false);

    const hasFailure = nextResults.some((item) => !item.ok);
    if (hasFailure) {
      setError("Some files failed to upload. Try again for those files.");
    } else {
      const uploadedFiles = [...files];
      setFiles([]);

      const isScheduleUpload = nextResults.some(
        (item) => item.ok && item.docType === "schedule"
      ) || uploadedFiles.some((f) => {
        const name = f.name.toLowerCase();
        return (
          name.includes("schedule") ||
          name.includes("calendar") ||
          name.includes("week") ||
          name.includes("timetable")
        );
      });

      if (isScheduleUpload) {
        setShowVerifier(true);
        return;
      }

      router.refresh();
    }
  };

  const handleVerifySemester = async (semester: string, currentWeek: number) => {
    try {
      const response = await fetch("/api/classes", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classId,
          semester,
          currentWeek,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to save semester info");
      }

      setShowVerifier(false);
      router.refresh();
    } catch (err) {
      throw err;
    }
  };

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
          {isUploading ? "Uploading..." : "Upload Documents"}
        </button>
        <div className="text-[11px] text-[color:var(--app-subtle)]">
          Max File Size 10MB. PDF Or Word Docs Only.
        </div>
      </div>

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
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      </div>

      <SemesterWeekVerifier
        classId={classId}
        isOpen={showVerifier}
        onClose={() => {
          setShowVerifier(false);
          router.refresh();
        }}
        onVerify={handleVerifySemester}
      />
    </>
  );
}
