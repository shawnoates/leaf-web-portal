"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import Parse from "@/lib/parse-client";

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
  personaName: string | null;
  personaAvatarUrl: string | null;
  messages: ThreadMessage[];
}

// One conversation from the owner inbox — owner/co-hosts on one side, the
// concierge or the plan's virtual host on the other. Same drawer skeleton as
// PlanChatDrawer / LeafHostPlanThread: right-side on desktop, bottom sheet on
// mobile.
//
// Co-hosts are first-class here: any message not written by YOU renders as
// theirs and shows its author, so a thread with an owner + two co-hosts reads
// correctly instead of collapsing into "you vs them".
export default function InboxThreadDrawer({
  calendarId,
  planId,
  onClose,
  onRead,
}: {
  calendarId: string;
  planId: string | null;
  onClose: () => void;
  onRead?: () => void;
}) {
  const [thread, setThread] = useState<ThreadPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [composeText, setComposeText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const r = (await Parse.Cloud.run("getInboxThread", {
          calendarId,
          planId: planId || undefined,
        })) as ThreadPayload;
        setThread(r);
        // Opening marks the thread read server-side — tell the inbox so the
        // badge drops now instead of on its next poll.
        onRead?.();
      } catch {
        // Access denied or thread vanished — leave the drawer empty rather
        // than throwing; the close button still works.
      } finally {
        setLoading(false);
      }
    },
    [calendarId, planId, onRead],
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
      // Keep the text in the box so the message isn't lost on a failed send.
    } finally {
      setSending(false);
    }
  }

  const counterpart = thread?.personaName || "Leaf Concierge";
  const subtitle = thread?.planTitle
    ? `${counterpart} · ${thread.planTitle}`
    : thread?.calendarName || "";

  return (
    <div
      className="fixed inset-0 z-50 flex md:justify-end items-end md:items-stretch bg-zinc-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full md:w-[560px] md:max-w-[95vw] rounded-t-2xl md:rounded-none md:rounded-l-2xl md:shadow-2xl relative flex flex-col h-[92vh] md:h-full overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 shrink-0">
          {thread?.personaAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thread.personaAvatarUrl}
              alt=""
              aria-hidden="true"
              className="w-9 h-9 rounded-full object-cover ring-1 ring-zinc-200 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-zinc-200 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-900 truncate">
              {counterpart}
            </p>
            <p className="text-xs text-zinc-500 truncate">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-900 rounded-full hover:bg-zinc-100"
            aria-label="Close conversation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
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
                {/* Show the author on anything that isn't yours — with
                    co-hosts in the thread, "not mine" no longer means
                    "the concierge". */}
                {!m.isMine && (
                  <span className="text-[11px] text-zinc-400 mb-0.5 px-1">
                    {m.authorName}
                  </span>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
                    m.isMine
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-900"
                  }`}
                >
                  {m.body}
                </div>
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
    </div>
  );
}
