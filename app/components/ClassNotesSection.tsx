"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type NoteItem = {
  id: string;
  classId: string;
  title: string;
  content: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function ClassNotesSection({
  classId,
  notes,
}: {
  classId: string;
  notes: NoteItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<NoteItem[]>(notes);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [pendingCreate, setPendingCreate] = useState(false);
  const [pendingSaveIds, setPendingSaveIds] = useState<Record<string, boolean>>({});
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, { title: string; content: string }>>({});
  const [error, setError] = useState<string | null>(null);

  const orderedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return dateB - dateA;
      }),
    [items]
  );

  const upsertDraft = (id: string, patch: Partial<{ title: string; content: string }>) => {
    setDrafts((prev) => {
      const existing = prev[id] ?? {
        title: items.find((item) => item.id === id)?.title ?? "",
        content: items.find((item) => item.id === id)?.content ?? "",
      };
      return {
        ...prev,
        [id]: { ...existing, ...patch },
      };
    });
  };

  const createNote = async () => {
    if (pendingCreate) return;
    setError(null);

    const content = newContent.trim();
    if (!content) {
      setError("Write something before saving a note.");
      return;
    }

    setPendingCreate(true);
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classId,
          title: newTitle,
          content,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create note");
      }

      const createdNote = payload?.note as NoteItem;
      setItems((prev) => [createdNote, ...prev]);
      setNewTitle("");
      setNewContent("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create note");
    } finally {
      setPendingCreate(false);
    }
  };

  const saveNote = async (id: string) => {
    if (pendingSaveIds[id]) return;
    setError(null);

    const draft = drafts[id] ?? {
      title: items.find((item) => item.id === id)?.title ?? "",
      content: items.find((item) => item.id === id)?.content ?? "",
    };

    setPendingSaveIds((prev) => ({ ...prev, [id]: true }));
    try {
      const response = await fetch("/api/notes", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          title: draft.title,
          content: draft.content,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save note");
      }

      const updatedNote = payload?.note as NoteItem;
      setItems((prev) => prev.map((item) => (item.id === id ? updatedNote : item)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setPendingSaveIds((prev) => ({ ...prev, [id]: false }));
    }
  };

  const deleteNote = async (id: string) => {
    if (pendingDeleteIds[id]) return;
    setError(null);

    setPendingDeleteIds((prev) => ({ ...prev, [id]: true }));
    try {
      const response = await fetch("/api/notes", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete note");
      }

      setItems((prev) => prev.filter((item) => item.id !== id));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
    } finally {
      setPendingDeleteIds((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-[color:var(--app-text)]">
          Personal Notes
        </h2>
        <div className="text-xs text-[color:var(--app-subtle)]">Saved per class</div>
      </div>

      <div className="mt-4 rounded-3xl bg-[color:var(--app-surface)] p-4 ring-1 ring-[color:var(--app-border)] shadow-[var(--app-shadow)]">
        <div className="text-xs font-medium text-[color:var(--app-subtle)]">New Note</div>
        <div className="mt-3 grid gap-3">
          <input
            type="text"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Title (optional)"
            className="w-full rounded-2xl bg-[color:var(--app-panel)] px-3 py-2 text-sm text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] placeholder:text-[color:var(--app-muted)] focus:outline-none"
          />
          <textarea
            value={newContent}
            onChange={(event) => setNewContent(event.target.value)}
            rows={6}
            placeholder="Write your notes for this class..."
            className="w-full rounded-2xl bg-[color:var(--app-panel)] px-3 py-2 text-sm text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] placeholder:text-[color:var(--app-muted)] focus:outline-none"
          />
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={createNote}
              disabled={pendingCreate}
              className="rounded-full bg-cyan-300 px-3.5 py-2 text-xs font-semibold text-black transition hover:bg-cyan-200 disabled:opacity-50"
            >
              {pendingCreate ? "Saving..." : "Save Note"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {orderedItems.length === 0 ? (
          <div className="rounded-2xl bg-[color:var(--app-surface)] p-6 text-sm text-[color:var(--app-subtle)] ring-1 ring-[color:var(--app-border)]">
            No notes yet.
          </div>
        ) : (
          orderedItems.map((note) => {
            const draft = drafts[note.id] ?? { title: note.title, content: note.content };
            return (
              <div
                key={note.id}
                className="rounded-2xl bg-[color:var(--app-surface)] p-4 ring-1 ring-[color:var(--app-border)] shadow-[var(--app-shadow)]"
              >
                <div className="grid gap-3">
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(event) => upsertDraft(note.id, { title: event.target.value })}
                    className="w-full rounded-2xl bg-[color:var(--app-panel)] px-3 py-2 text-sm text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] placeholder:text-[color:var(--app-muted)] focus:outline-none"
                  />
                  <textarea
                    rows={6}
                    value={draft.content}
                    onChange={(event) => upsertDraft(note.id, { content: event.target.value })}
                    className="w-full rounded-2xl bg-[color:var(--app-panel)] px-3 py-2 text-sm text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] placeholder:text-[color:var(--app-muted)] focus:outline-none"
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] text-[color:var(--app-subtle)]">
                    Updated {formatDate(note.updatedAt)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveNote(note.id)}
                      disabled={Boolean(pendingSaveIds[note.id])}
                      className="rounded-full bg-[color:var(--app-chip)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] transition hover:bg-[color:var(--app-elevated)] disabled:opacity-50"
                    >
                      {pendingSaveIds[note.id] ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNote(note.id)}
                      disabled={Boolean(pendingDeleteIds[note.id])}
                      className="rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-red-500/90 disabled:opacity-50"
                    >
                      {pendingDeleteIds[note.id] ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error ? (
        <div className="mt-3 rounded-2xl bg-red-500/10 p-3 text-xs text-red-300 ring-1 ring-red-500/20">
          {error}
        </div>
      ) : null}
    </section>
  );
}
