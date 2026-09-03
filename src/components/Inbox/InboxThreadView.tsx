"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import Parse from "@/lib/parse-client";
import PlanContextPanel, { type PlanContext } from "./PlanContextPanel";

interface ThreadMessage {
  objectId: string;
  senderRole: "owner" | "concierge" | string;
  authorName: string;
  body: string;
  kind: string;
  isMine: boolean;
  createdAt: string | null;
}

interface ThreadPayload {
  threadKey: string;
  threadKind: string;
  calendarId: string;
  calendarName: string;
  planId: string | null;
  planTitle: string | null;
  plan: PlanContext | null;
  messages: ThreadMessage[];
}

function formatStamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// One conversation, rendered to fill its parent — the right pane of the inbox
// page. No drawer chrome: the inbox owns the layout, this owns the thread.
//
// `onBack` only renders on mobile, where the list and the thread occupy the
// same column and the pane needs its own way out.
export default function InboxThreadView({
  calendarId,
  planId,
  onRead,
  onBack,
}: {
  calendarId: string;
  planId: string | null;
  onRead?: () => void;
  onBack?: () => void;
}) {
  const [thread, setThread] = useState<ThreadPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [composeText, setComposeText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Ref so the 15s poll doesn't tear down and rebuild on every parent render.
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const r = (await Parse.Cloud.run("getInboxThread", {
          calendarId,
          planId: planId || undefined,
        })) as ThreadPayload;
        setThread(r);
        onReadRef.current?.();
      } catch {
        // Access denied or thread vanished — render the empty state rather
        // than throwing out of the pane.
      } finally {
        setLoading(false);
      }
    },
    [calendarId, planId],
  );

  useEffect(() => {
    load();
    const t = setInterval(() => load({ silent: true }), 15_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.messages.length]);

  async function send() {
    const body = composeText.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const msg = (await Parse.Cloud.run("sendInboxMessage", {
        calendarId,
        planId: planId || undefined,
        body,
      })) as ThreadMessage;
      setThread((prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg] } : prev,
      );
      setComposeText("");
    } catch {
      // Leave the text in the box so a failed send doesn't lose it.
    } finally {
      setSending(false);
    }
  }

  // The other side of this thread is Leaf, openly. A persona name won here
  // until 2026-09-03, which put a human name on a conversation with nobody
  // behind it — the exact thing the human-identity invariant forbids.
  const counterpart = "Leaf Concierge";

  return (
    <div className="flex h-full min-h-0">
      <div className="flex flex-col flex-1 min-w-0 min-h-0 bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1.5 text-zinc-500 hover:text-zinc-900 rounded-full hover:bg-zinc-100"
            aria-label="Back to inbox"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="w-9 h-9 rounded-full bg-zinc-200 shrink-0 flex items-center justify-center text-zinc-500 text-xs font-bold">
          {counterpart.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 truncate">
            {counterpart}
          </p>
          <p className="text-xs text-zinc-500 truncate">
            {thread?.planTitle || thread?.calendarName || ""}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
          </div>
        ) : !thread || thread.messages.length === 0 ? (
          <p className="text-center text-sm text-zinc-400 py-12">
            No messages yet. Ask a question and {counterpart} will pick it up.
          </p>
        ) : (
          thread.messages.map((m) => (
            <div
              key={m.objectId}
              className={`flex flex-col ${m.isMine ? "items-end" : "items-start"}`}
            >
              {/* Author shows on anything that isn't yours — with co-hosts in
                  the thread, "not mine" no longer means "the concierge". */}
              {!m.isMine && (
                <span className="text-[11px] text-zinc-400 mb-0.5 px-1">
                  {m.authorName}
                </span>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
                  m.isMine ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"
                }`}
              >
                {m.body}
              </div>
              <span className="text-[10px] text-zinc-300 mt-0.5 px-1">
                {formatStamp(m.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-zinc-100 px-4 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={composeText}
            onChange={(e) => setComposeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Write a message"
            rows={1}
            autoComplete="off"
            className="flex-1 resize-none border border-zinc-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 max-h-32"
          />
          <button
            onClick={send}
            disabled={sending || !composeText.trim()}
            className="p-2.5 rounded-lg bg-zinc-900 text-white disabled:opacity-40 hover:bg-zinc-800 transition-colors"
            aria-label="Send message"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      </div>

      {/* Right rail: the plan under discussion. Plan threads only — a
          calendar-level concierge thread has no single plan to describe. */}
      {thread?.plan && <PlanContextPanel plan={thread.plan} />}
    </div>
  );
}
