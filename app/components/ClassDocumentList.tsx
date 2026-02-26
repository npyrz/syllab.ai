"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DocumentItem = {
  id: string;
  filename: string;
  status: string;
  createdAt: string | Date;
  processedAt: string | Date | null;
};

function formatStatus(status: string) {
  if (status === "pending") return "Queued For Extraction";
  if (status === "processing") return "Extracting Text";
  if (status === "done") return "Ready";
  if (status === "failed") return "Extraction Failed";

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string | Date | null) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export default function ClassDocumentList({
  documents,
}: {
  documents: DocumentItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<DocumentItem[]>(documents);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasItems = items.length > 0;

  const orderedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      }),
    [items]
  );

  const handleDelete = async (id: string) => {
    if (pendingId) return;
    setPendingId(id);
    setError(null);

    try {
      const response = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to delete document");
      }

      setItems((prev) => prev.filter((item) => item.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setPendingId(null);
      setConfirmId(null);
    }
  };

  if (!hasItems) {
    return (
      <div className="rounded-2xl bg-[color:var(--app-surface)] p-6 text-sm text-[color:var(--app-subtle)] ring-1 ring-[color:var(--app-border)]">
        No Documents Uploaded Yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {orderedItems.map((doc) => {
        const created = formatDate(doc.createdAt);
        const processed = formatDate(doc.processedAt);
        return (
          <div
            key={doc.id}
            className="rounded-2xl bg-[color:var(--app-surface)] p-4 ring-1 ring-[color:var(--app-border)] shadow-[var(--app-shadow)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[color:var(--app-text)]">
                  {doc.filename}
                </div>
                <div className="mt-2 text-xs text-[color:var(--app-subtle)]">
                  {created ? `Uploaded ${created}` : "Uploaded"}
                  {processed ? ` • Processed ${processed}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-[color:var(--app-subtle)]">
                  {formatStatus(doc.status)}
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmId(doc.id)}
                  disabled={pendingId === doc.id}
                  className="rounded-full bg-[color:var(--app-chip)] px-2.5 py-1 text-[11px] text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] transition hover:bg-[color:var(--app-elevated)] disabled:opacity-50"
                >
                  {pendingId === doc.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {confirmId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-[color:var(--app-surface)] p-6 text-sm text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
            <div className="text-base font-semibold text-[color:var(--app-text)]">
              Delete Document?
            </div>
            <div className="mt-2 text-xs text-[color:var(--app-subtle)]">
              This removes the document and its extracted text. This action cannot be undone.
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                disabled={Boolean(pendingId)}
                className="rounded-full bg-[color:var(--app-panel)] px-3.5 py-2 text-xs font-medium text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] transition hover:bg-[color:var(--app-elevated)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmId)}
                disabled={Boolean(pendingId)}
                className="rounded-full bg-red-500 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(239,68,68,0.35)] transition hover:bg-red-500/90 disabled:opacity-50"
              >
                {pendingId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl bg-red-500/10 p-3 text-xs text-red-300 ring-1 ring-red-500/20">
          {error}
        </div>
      ) : null}
    </div>
  );
}
