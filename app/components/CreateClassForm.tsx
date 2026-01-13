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
    <div className="rounded-3xl bg-white/6 p-5 ring-1 ring-white/10 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-50">{title}</div>
          <div className="mt-1 text-xs text-zinc-400">{helper}</div>
        </div>
        <div className="text-xs text-zinc-400">{summary}</div>
      </div>

      <label
        className={
          "mt-4 block cursor-pointer rounded-2xl border border-dashed p-6 text-center text-sm text-zinc-300 transition " +
          (dragOver
            ? "border-cyan-300/60 bg-cyan-300/10"
            : "border-white/15 bg-black/30 hover:border-white/25")
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
        <div className="font-medium text-zinc-200">
          Drag and drop files here
        </div>
        <div className="mt-1 text-xs text-zinc-400">or click to browse</div>
      </label>

      {bucket.files.length ? (
        <div className="mt-4 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
          <div className="text-xs font-medium text-zinc-200">Selected</div>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
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
  const [logo, setLogo] = useState<File | null>(null);

  const [syllabus, setSyllabus] = useState<FileBucket>({ files: [] });
  const [schedule, setSchedule] = useState<FileBucket>({ files: [] });
  const [misc, setMisc] = useState<FileBucket>({ files: [] });

  const canSubmit = className.trim().length > 0 && semester.trim().length > 0;

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canSubmit) return;

        await fetch("/api/classes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            className,
            semester,
            logoFileName: logo?.name ?? null,
            uploads: {
              syllabus: syllabus.files.map((f) => f.name),
              schedule: schedule.files.map((f) => f.name),
              misc: misc.files.map((f) => f.name),
            },
          }),
        });

        window.location.href = "/home";
      }}
    >
      <div className="rounded-3xl bg-white/6 p-6 ring-1 ring-white/10 backdrop-blur-xl">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <div className="text-xs font-medium text-zinc-200">Class name</div>
            <input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. BIO 201"
              className="mt-2 w-full rounded-2xl bg-black/30 px-4 py-3 text-sm text-zinc-100 ring-1 ring-white/10 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-zinc-200">Semester</div>
            <input
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder="e.g. Spring 2026"
              className="mt-2 w-full rounded-2xl bg-black/30 px-4 py-3 text-sm text-zinc-100 ring-1 ring-white/10 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <div className="text-xs font-medium text-zinc-200">Logo (optional)</div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full rounded-2xl bg-black/30 px-4 py-3 text-sm text-zinc-300 ring-1 ring-white/10 file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-zinc-100 hover:file:bg-white/15"
          />
          <div className="mt-2 text-xs text-zinc-400">
            {logo ? `Selected: ${logo.name}` : "No logo selected"}
          </div>
        </label>
      </div>

      <Dropzone
        title="Upload syllabus"
        helper="Drag and drop your syllabus (PDF, DOCX, etc.)"
        bucket={syllabus}
        setBucket={setSyllabus}
        multiple={false}
      />

      <Dropzone
        title="Upload schedule / calendar"
        helper="Drag and drop your schedule (PDF, image, etc.)"
        bucket={schedule}
        setBucket={setSchedule}
        multiple={false}
      />

      <Dropzone
        title="Upload misc documents"
        helper="Any additional documents (handouts, policies, etc.)"
        bucket={misc}
        setBucket={setMisc}
        multiple
      />

      <div className="rounded-3xl bg-white/6 p-5 text-xs text-zinc-400 ring-1 ring-white/10 backdrop-blur-xl">
        <div className="text-xs font-medium text-zinc-200">Copyright notice</div>
        <p className="mt-2 leading-5">
          Upload only materials you own or have permission to use.
          We process files to extract text and aim to minimize retention of original uploads.
        </p>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_14px_40px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Create class
      </button>
    </form>
  );
}
