"use client";

import { useMemo, useState } from "react";

type FileBucket = {
  files: File[];
};

function formatFileCount(files: File[]) {
  if (files.length === 0) return "No files selected";
  if (files.length === 1) return files[0].name;
  return `${files.length} files selected`;
}

function Dropzone(props: {
  title: string;
  helper: string;
  accept?: string;
  multiple?: boolean;
  bucket: FileBucket;
  setBucket: (next: FileBucket) => void;
}) {
  const { title, helper, accept, multiple, bucket, setBucket } = props;
  const [dragOver, setDragOver] = useState(false);

  const summary = useMemo(() => formatFileCount(bucket.files), [bucket.files]);

  return (
    <div className="rounded-3xl bg-[color:var(--app-surface)] p-5 ring-1 ring-[color:var(--app-border)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-[color:var(--app-text)]">{title}</div>
          <div className="mt-1 text-xs text-[color:var(--app-subtle)]">{helper}</div>
        </div>
        <div className="text-xs text-[color:var(--app-subtle)]">{summary}</div>
      </div>

      <label
        className={
          "mt-4 block cursor-pointer rounded-2xl border border-dashed p-6 text-center text-sm text-[color:var(--app-text)] transition " +
          (dragOver
            ? "border-cyan-300/60 bg-cyan-300/10"
            : "border-[color:var(--app-border)] bg-[color:var(--app-panel)] hover:border-[color:var(--app-subtle)]")
        }
        onDragEnter={() => setDragOver(true)}
        onDragLeave={() => setDragOver(false)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);

          const incoming = Array.from(e.dataTransfer.files);
          setBucket({ files: multiple ? incoming : incoming.slice(0, 1) });
        }}
      >
        <input
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            const incoming = Array.from(e.target.files ?? []);
            setBucket({ files: multiple ? incoming : incoming.slice(0, 1) });
          }}
        />
        <div className="font-medium text-[color:var(--app-text)]">
          Drag and drop files here
        </div>
        <div className="mt-1 text-xs text-[color:var(--app-subtle)]">or click to browse</div>
      </label>

      {bucket.files.length ? (
        <div className="mt-4 rounded-2xl bg-[color:var(--app-panel)] p-4 ring-1 ring-[color:var(--app-border)]">
          <div className="text-xs font-medium text-[color:var(--app-text)]">Selected</div>
          <ul className="mt-2 space-y-1 text-xs text-[color:var(--app-subtle)]">
            {bucket.files.map((file) => (
              <li key={`${file.name}-${file.size}`}>{file.name}</li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-3 text-xs text-cyan-200 hover:text-cyan-100"
            onClick={() => setBucket({ files: [] })}
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function CreateClassForm() {
  const [className, setClassName] = useState("");
  const [semester, setSemester] = useState("");

  const [syllabus, setSyllabus] = useState<FileBucket>({ files: [] });
  const [schedule, setSchedule] = useState<FileBucket>({ files: [] });
  const [misc, setMisc] = useState<FileBucket>({ files: [] });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = className.trim().length > 0 && semester.trim().length > 0 && !isSubmitting;

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canSubmit) return;

        setIsSubmitting(true);
        setError(null);

        try {
          // Step 1: Create the class
          const classResponse = await fetch("/api/classes", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              title: className,
              description: semester,
            }),
          });

          if (!classResponse.ok) {
            const errorData = await classResponse.json();
            throw new Error(errorData.error || "Failed to create class");
          }

          const { class: newClass } = await classResponse.json();
          const classId = newClass.id;

          // Step 2: Upload all files
          const allFiles = [
            ...syllabus.files,
            ...schedule.files,
            ...misc.files,
          ];

          for (const file of allFiles) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("classId", classId);

            const uploadResponse = await fetch("/api/documents", {
              method: "POST",
              body: formData,
            });

            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json();
              console.error(`Failed to upload ${file.name}:`, errorData);
              // Continue with other files even if one fails
            }
          }

          // Step 3: Redirect to home
          window.location.href = "/home";
        } catch (err) {
          console.error("Error creating class:", err);
          setError(err instanceof Error ? err.message : "Failed to create class");
          setIsSubmitting(false);
        }
      }}
    >
      <div className="rounded-3xl bg-[color:var(--app-surface)] p-6 ring-1 ring-[color:var(--app-border)] backdrop-blur-xl">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <div className="text-xs font-medium text-[color:var(--app-text)]">Class name</div>
            <input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. BIO 201"
              className="mt-2 w-full rounded-2xl bg-[color:var(--app-panel)] px-4 py-3 text-sm text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] placeholder:text-[color:var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-[color:var(--app-text)]">Semester</div>
            <input
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder="e.g. Spring 2026"
              className="mt-2 w-full rounded-2xl bg-[color:var(--app-panel)] px-4 py-3 text-sm text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] placeholder:text-[color:var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </label>
        </div>
      </div>

      <Dropzone
        title="Upload syllabus"
        helper="Drag and drop your syllabus (PDF, DOCX, etc.)"
        accept=".pdf,.docx,.doc"
        bucket={syllabus}
        setBucket={setSyllabus}
        multiple={false}
      />

      <Dropzone
        title="Upload schedule / calendar (optional)"
        helper="Drag and drop your schedule (PDF, image, etc.)"
        accept=".pdf,.docx,.doc"
        bucket={schedule}
        setBucket={setSchedule}
        multiple={false}
      />

      <Dropzone
        title="Upload misc documents (optional)"
        helper="Any additional documents (handouts, policies, etc.)"
        accept=".pdf,.docx,.doc"
        bucket={misc}
        setBucket={setMisc}
        multiple
      />

      <div className="rounded-3xl bg-[color:var(--app-surface)] p-5 text-xs text-[color:var(--app-subtle)] ring-1 ring-[color:var(--app-border)] backdrop-blur-xl">
        <div className="text-xs font-medium text-[color:var(--app-text)]">Copyright notice</div>
        <p className="mt-2 leading-5">
          Upload only materials you own or have permission to use.
          We process files to extract text and aim to minimize retention of original uploads.
        </p>
      </div>

      {error && (
        <div className="rounded-3xl bg-red-500/10 p-5 text-xs text-red-300 ring-1 ring-red-500/20 backdrop-blur-xl">
          <div className="text-xs font-medium">Error</div>
          <p className="mt-2 leading-5">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_14px_40px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creating class..." : "Create class"}
      </button>
    </form>
  );
}
