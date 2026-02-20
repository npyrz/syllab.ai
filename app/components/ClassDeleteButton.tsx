"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClassDeleteButtonProps = {
  classId: string;
  classTitle: string;
};

export default function ClassDeleteButton({
  classId,
  classTitle,
}: ClassDeleteButtonProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/classes", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: classId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to delete class");
      }

      setConfirmOpen(false);
      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete class");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="inline-flex items-center justify-center rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-500 ring-1 ring-red-500/30 transition hover:bg-red-500/20"
      >
        Delete class
      </button>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-[color:var(--app-surface)] p-6 text-sm text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
            <div className="text-base font-semibold text-[color:var(--app-text)]">
              Delete class?
            </div>
            <div className="mt-2 text-xs text-[color:var(--app-subtle)]">
              This removes {classTitle} and all documents in it. This action cannot be undone.
            </div>
            {error ? (
              <div className="mt-3 rounded-2xl bg-red-500/10 p-3 text-xs text-red-400 ring-1 ring-red-500/20">
                {error}
              </div>
            ) : null}
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isDeleting}
                className="rounded-full bg-[color:var(--app-panel)] px-3.5 py-2 text-xs font-medium text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] transition hover:bg-[color:var(--app-elevated)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-full bg-red-500 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(239,68,68,0.35)] transition hover:bg-red-500/90 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete class"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
