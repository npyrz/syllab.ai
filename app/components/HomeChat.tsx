"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const activeButtonClass =
  "inline-flex items-center gap-2 rounded-full bg-[color:var(--app-chip)] px-3 py-2 text-xs font-medium text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] transition";
const idleButtonClass =
  "inline-flex items-center gap-2 rounded-full bg-[color:var(--app-panel)] px-3 py-2 text-xs font-medium text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] transition hover:bg-[color:var(--app-surface)]";

type ClassOption = {
  id: string;
  title: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
};

const CHAT_META_PREFIX = "\n<<__CHAT_META__";
const CHAT_META_SUFFIX = "__>>";

function extractChatMeta(rawContent: string): { content: string; sources: string[] } {
  const metaStart = rawContent.lastIndexOf(CHAT_META_PREFIX);
  if (metaStart === -1) {
    return { content: rawContent, sources: [] };
  }

  const jsonStart = metaStart + CHAT_META_PREFIX.length;
  const metaEnd = rawContent.indexOf(CHAT_META_SUFFIX, jsonStart);
  if (metaEnd === -1) {
    return { content: rawContent, sources: [] };
  }

  const jsonPayload = rawContent.slice(jsonStart, metaEnd);
  const visibleContent = `${rawContent.slice(0, metaStart)}${rawContent.slice(metaEnd + CHAT_META_SUFFIX.length)}`;

  try {
    const parsed = JSON.parse(jsonPayload) as { sources?: unknown };
    const sources = Array.isArray(parsed.sources)
      ? parsed.sources.filter((value): value is string => typeof value === "string")
      : [];

    return { content: visibleContent, sources };
  } catch {
    return { content: rawContent, sources: [] };
  }
}

function formatLimitMessage(error: {
  error?: string;
  retryAt?: string;
  retryAfterSeconds?: number;
}) {
  const base = error?.error ?? "Daily usage limit reached.";
  if (!error?.retryAt) {
    return `Usage limit reached. ${base}`;
  }

  const date = new Date(error.retryAt);
  if (Number.isNaN(date.getTime())) {
    return `Usage limit reached. ${base}`;
  }

  return `Usage limit reached. ${base} You can try again after ${date.toLocaleString()}.`;
}

function getInitials(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase());
  return initials.join("") || "?";
}

function formatSourceLabel(source: string) {
  const normalized = source.split("/").filter(Boolean);
  return normalized[normalized.length - 1] ?? source;
}

export default function HomeChat({ classes }: { classes: ClassOption[] }) {
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id ?? ""
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [includeNotes, setIncludeNotes] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  const selectedClass = classes.find((course) => course.id === selectedClassId);
  const canSend = !!input.trim() && !!selectedClassId && !isLoading;
  const sendLabel = isLoading ? "Sending..." : "Send";

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || !selectedClassId || isLoading) return;

    const userMessage = trimmedInput;
    const userId = `${Date.now()}-user`;
    const assistantId = `${Date.now()}-assistant`;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: userMessage },
      { id: assistantId, role: "assistant", content: "", sources: [] },
    ]);
    setIsLoading(true);
    setStreamingMessageId(assistantId);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClassId,
          message: userMessage,
          includeNotes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content:
                    response.status === 429
                      ? formatLimitMessage(error)
                      : `Error: ${error.error}`,
                }
              : msg
          )
        );
        setStreamingMessageId(null);
        return;
      }

      if (!response.body) {
        const data = await response.json();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: data.response, sources: data.sources ?? [] }
              : msg
          )
        );
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const tokenChunk = decoder.decode(value, { stream: true });
        if (!tokenChunk) continue;

        accumulated += tokenChunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: accumulated }
              : msg
          )
        );
      }

      const remaining = decoder.decode();
      if (remaining) {
        accumulated += remaining;
      }

      const parsed = extractChatMeta(accumulated);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: parsed.content, sources: parsed.sources }
            : msg
        )
      );
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: "Failed to get response. Try again." }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-[color:var(--app-bg)] text-[color:var(--app-text)]">
      <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-5xl flex-col px-6 py-12">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h1 className="text-balance text-3xl font-normal tracking-tight text-[color:var(--app-text)] sm:text-4xl">
              Ask about your classes
            </h1>
            <p className="mt-3 max-w-xl text-sm text-[color:var(--app-subtle)]">
              Pick a class and ask a question to get summaries, deadlines, and key details.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pb-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-4 flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 shadow-sm ${
                    msg.role === "user"
                      ? "max-w-[78%] bg-cyan-300 text-black"
                      : "max-w-[92%] sm:max-w-[88%] lg:max-w-[86%] bg-[color:var(--app-surface)] text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)]"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div>
                      {msg.content.trim().length === 0 && msg.id === streamingMessageId ? (
                        <div className="flex items-center gap-2 text-sm text-[color:var(--app-subtle)]">
                          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                          Thinking…
                        </div>
                      ) : (
                        <div className="prose prose-sm max-w-none break-words whitespace-pre-wrap text-[color:var(--app-text)] prose-headings:mb-1 prose-headings:mt-3 prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base prose-p:my-1 prose-p:whitespace-pre-wrap prose-p:leading-6 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-li:leading-6 prose-strong:text-[color:var(--app-text)] prose-code:rounded prose-code:bg-[color:var(--app-panel)] prose-code:px-1 prose-code:py-0.5 prose-code:text-cyan-300 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:bg-[color:var(--app-panel)] prose-table:my-2 prose-table:w-full prose-table:border-collapse prose-table:overflow-hidden prose-table:rounded-lg prose-table:ring-1 prose-table:ring-[color:var(--app-border)] prose-thead:border-b prose-thead:border-[color:var(--app-border)] prose-th:border-r prose-th:border-[color:var(--app-border)] prose-th:bg-[color:var(--app-panel)] prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:last:border-r-0 prose-tr:border-b prose-tr:border-[color:var(--app-border)] prose-tr:last:border-b-0 prose-td:border-r prose-td:border-[color:var(--app-border)] prose-td:px-3 prose-td:py-2 prose-td:last:border-r-0 prose-a:text-cyan-300">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--app-border)] pt-3">
                          {msg.sources.map((src, i) => (
                            <button
                              key={i}
                              type="button"
                              title={src}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[color:var(--app-panel)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--app-subtle)] ring-1 ring-[color:var(--app-border)] transition hover:bg-[color:var(--app-elevated)]"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-[color:var(--app-muted)]">
                                <path fillRule="evenodd" d="M4 2a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5V6.621a1.5 1.5 0 0 0-.44-1.06L9.94 2.439A1.5 1.5 0 0 0 8.878 2H4Zm4 3.5a.75.75 0 0 1 .75.75v2.69l.72-.72a.75.75 0 1 1 1.06 1.06l-2 2a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 0 1 1.06-1.06l.72.72V6.25A.75.75 0 0 1 8 5.5Z" clipRule="evenodd" />
                              </svg>
                              <span className="truncate">{formatSourceLabel(src)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomAnchorRef} />
          </div>
        )}

        <div className="mt-10 rounded-3xl bg-[color:var(--app-surface)] p-4 ring-1 ring-[color:var(--app-border)]">
          <div className="flex flex-wrap items-center gap-2">
            {classes.map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => setSelectedClassId(course.id)}
                disabled={isLoading}
                className={
                  course.id === selectedClassId ? activeButtonClass : idleButtonClass
                }
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-300/15 text-[11px] font-semibold text-cyan-700">
                  {getInitials(course.title)}
                </span>
                {course.title}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <label className="inline-flex items-center gap-2.5 rounded-xl bg-[color:var(--app-panel)] px-3 py-2 text-xs font-medium text-[color:var(--app-subtle)] ring-1 ring-[color:var(--app-border)]">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(event) => setIncludeNotes(event.target.checked)}
                disabled={isLoading}
                className="h-4 w-4 rounded border-[color:var(--app-border)] bg-[color:var(--app-surface)] text-cyan-300 focus:ring-cyan-300"
              />
              <span>Include class notes in AI context</span>
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[color:var(--app-panel)] px-4 py-3 ring-1 ring-[color:var(--app-border)]">
            <input
              type="text"
              placeholder={
                selectedClass
                  ? `Ask about ${selectedClass.title}...`
                  : "Ask something about your classes..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isLoading}
              className="w-full bg-transparent text-sm text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted)] focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!canSend}
              className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendLabel}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
