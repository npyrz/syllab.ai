"use client";

import { useState } from "react";
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
  role: "user" | "assistant";
  content: string;
  sources?: string[];
};

function getInitials(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase());
  return initials.join("") || "?";
}

export default function HomeChat({ classes }: { classes: ClassOption[] }) {
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id ?? ""
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const selectedClass = classes.find((course) => course.id === selectedClassId);

  const handleSendMessage = async () => {
    if (!input.trim() || !selectedClassId || isLoading) return;

    const userMessage = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClassId,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${error.error}` },
        ]);
        return;
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response, sources: data.sources ?? [] },
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to get response. Try again." },
      ]);
    } finally {
      setIsLoading(false);
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
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "max-w-lg bg-cyan-300 text-black"
                      : "max-w-2xl bg-[color:var(--app-surface)] text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)]"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div>
                      <div className="prose prose-sm max-w-none prose-headings:text-[color:var(--app-text)] prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:leading-relaxed prose-li:leading-relaxed prose-strong:text-cyan-300 prose-code:text-cyan-300 prose-code:bg-[color:var(--app-panel)] prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-a:text-cyan-300">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--app-border)] pt-3">
                          {msg.sources.map((src, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--app-panel)] px-3 py-1 text-[11px] font-medium text-[color:var(--app-subtle)] ring-1 ring-[color:var(--app-border)] select-none"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-[color:var(--app-muted)]">
                                <path fillRule="evenodd" d="M4 2a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5V6.621a1.5 1.5 0 0 0-.44-1.06L9.94 2.439A1.5 1.5 0 0 0 8.878 2H4Zm4 3.5a.75.75 0 0 1 .75.75v2.69l.72-.72a.75.75 0 1 1 1.06 1.06l-2 2a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 0 1 1.06-1.06l.72.72V6.25A.75.75 0 0 1 8 5.5Z" clipRule="evenodd" />
                              </svg>
                              {src}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[color:var(--app-surface)] text-[color:var(--app-subtle)] rounded-2xl px-4 py-3 ring-1 ring-[color:var(--app-border)]">
                  Thinking...
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-10 rounded-3xl bg-[color:var(--app-surface)] p-4 ring-1 ring-[color:var(--app-border)]">
          <div className="flex flex-wrap items-center gap-2">
            {classes.map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => setSelectedClassId(course.id)}
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
                if (e.key === "Enter" && !e.shiftKey) {
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
              disabled={isLoading || !input.trim()}
              className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-black transition hover:bg-cyan-200 disabled:opacity-50"
            >
              {isLoading ? "..." : "Send"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
