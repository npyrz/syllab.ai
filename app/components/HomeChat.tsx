"use client";

import { useRef, useState } from "react";
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
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const streamBufferRef = useRef("");
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedClass = classes.find((course) => course.id === selectedClassId);

  const handleSendMessage = async () => {
    if (!input.trim() || !selectedClassId || isLoading) return;

    const userMessage = input;
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
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: `Error: ${error.error}` }
              : msg
          )
        );
        setStreamingMessageId(null);
        return;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream") || !response.body) {
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
      let buffered = "";

      const flushBufferedTokens = () => {
        const bufferedTokens = streamBufferRef.current;
        if (!bufferedTokens) return;
        streamBufferRef.current = "";

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: `${msg.content}${bufferedTokens}` }
              : msg
          )
        );
      };

      const ensureFlushTimer = () => {
        if (streamTimerRef.current) return;
        streamTimerRef.current = setInterval(flushBufferedTokens, 160);
      };

      const stopFlushTimer = () => {
        if (!streamTimerRef.current) return;
        clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
      };

      const flushEvent = (rawEvent: string) => {
        const lines = rawEvent.split("\n");
        let eventName = "message";
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }

        if (dataLines.length === 0) return;
        const payload = JSON.parse(dataLines.join("\n"));

        if (eventName === "token") {
          streamBufferRef.current += payload.token;
          ensureFlushTimer();
          return;
        }

        if (eventName === "done") {
          stopFlushTimer();
          flushBufferedTokens();
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: payload.response ?? msg.content,
                    sources: payload.sources ?? [],
                  }
                : msg
            )
          );
          setStreamingMessageId(null);
          return;
        }

        if (eventName === "error") {
          stopFlushTimer();
          flushBufferedTokens();
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: `Error: ${payload.error ?? "Stream failed"}`,
                  }
                : msg
            )
          );
          setStreamingMessageId(null);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffered += decoder.decode(value, { stream: true });
        const parts = buffered.split("\n\n");
        buffered = parts.pop() ?? "";

        for (const part of parts) {
          if (part.trim()) flushEvent(part);
        }
      }

      stopFlushTimer();
      flushBufferedTokens();
    } catch (error) {
      console.error("Chat error:", error);
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
      }
      streamBufferRef.current = "";
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
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
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
                      {msg.content.trim().length === 0 && msg.id === streamingMessageId ? (
                        <div className="text-sm text-[color:var(--app-subtle)]">Thinking...</div>
                      ) : (
                        <div className="prose prose-sm max-w-none prose-headings:text-[color:var(--app-text)] prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:leading-relaxed prose-li:leading-relaxed prose-strong:text-cyan-300 prose-code:text-cyan-300 prose-code:bg-[color:var(--app-panel)] prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-a:text-cyan-300">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
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
