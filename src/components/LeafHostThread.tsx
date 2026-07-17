"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import Parse from "@/lib/parse-client";
import LeafHostPayCard from "./LeafHostPayCard";

// Server payload shapes. Mirror what getLeafHostThread returns; kept
// narrow so a widened server response doesn't silently render.
interface Persona {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface ThreadMessage {
  objectId: string;
  senderRole: "owner" | "concierge";
  authorName: string;
  body: string;
  kind: string;
  createdAt: string | null;
}

interface InFlight {
  hostingId: string;
  status: string;
  paymentStatus: string;
  planCount: number;
  quotedTotal: number;
}

interface ThreadPayload {
  calendarId: string;
  calendarName: string;
  persona: Persona;
  perPlanRate: number;
  maxGroupSize: number;
  turnaroundHours: number;
  messages: ThreadMessage[];
  inFlight: InFlight | null;
}

// Chat-drawer for the paid-hosting offer. Replaces the earlier
// LeafHostSheet — same drawer skeleton (right-side desktop, bottom
// mobile) but the body is a persona-voiced message thread with an
// inline pay card, not a static form. Continuity is the win: after
// authorization the same drawer carries proposals, approvals, and
// updates.
export default function LeafHostThread({
  calendarId,
  onClose,
}: {
  calendarId: string;
  onClose: () => void;
}) {
  const [thread, setThread] = useState<ThreadPayload | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const result = (await Parse.Cloud.run("getLeafHostThread", {
        calendarId,
      })) as ThreadPayload;
      setThread(result);
      setLoadState("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Couldn't load thread.");
      setLoadState("error");
    }
  }, [calendarId]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-scroll to bottom whenever a new message lands. Not a
  // pixel-perfect scroll-lock — just keeps the latest message visible.
  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread?.messages.length]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const result = (await Parse.Cloud.run("sendLeafHostMessage", {
        calendarId,
        body,
      })) as { message: ThreadMessage };
      setThread((prev) =>
        prev ? { ...prev, messages: [...prev.messages, result.message] } : prev,
      );
      setDraft("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't send.";
      alert(msg);
    } finally {
      setSending(false);
    }
  };

  // Grouping consecutive messages by sender keeps the avatar column
  // clean — persona face appears once per burst.
  const messageGroups = useMemo(() => {
    if (!thread) return [];
    const groups: {
      senderRole: "owner" | "concierge";
      messages: ThreadMessage[];
    }[] = [];
    for (const m of thread.messages) {
      const last = groups[groups.length - 1];
      if (last && last.senderRole === m.senderRole) {
        last.messages.push(m);
      } else {
        groups.push({ senderRole: m.senderRole, messages: [m] });
      }
    }
    return groups;
  }, [thread]);

  return (
    <div
      className="fixed inset-0 z-50 flex md:justify-end items-end md:items-stretch bg-zinc-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full md:w-[560px] md:max-w-[95vw] rounded-t-2xl md:rounded-none md:rounded-l-2xl md:shadow-2xl relative flex flex-col h-[92vh] md:h-full"
      >
        {/* Header — persona identity + close. Reads as the top of a
            chat window; no drawer chrome fighting for attention. */}
        {thread?.persona && (
          <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100">
            {thread.persona.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thread.persona.avatarUrl}
                alt=""
                aria-hidden="true"
                className="w-9 h-9 rounded-full object-cover ring-1 ring-zinc-200 flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-zinc-200 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-900 truncate">
                {thread.persona.name}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                Your concierge for {thread.calendarName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-900"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {loadState === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
          </div>
        )}

        {loadState === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-zinc-600">{errorMsg}</p>
            <button
              onClick={onClose}
              className="text-sm text-zinc-500 hover:text-zinc-900 underline"
            >
              Close
            </button>
          </div>
        )}

        {loadState === "ready" && thread && (
          <>
            <div
              ref={messagesScrollRef}
              className="flex-1 overflow-y-auto px-5 py-6 space-y-6"
            >
              {messageGroups.map((group, gi) => (
                <div
                  key={gi}
                  className={`flex gap-3 ${group.senderRole === "owner" ? "flex-row-reverse" : ""}`}
                >
                  {group.senderRole === "concierge" ? (
                    thread.persona.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thread.persona.avatarUrl}
                        alt=""
                        aria-hidden="true"
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-zinc-200"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-200 flex-shrink-0" />
                    )
                  ) : (
                    <div className="w-8 h-8 flex-shrink-0" />
                  )}
                  <div
                    className={`flex-1 min-w-0 space-y-1 ${group.senderRole === "owner" ? "items-end" : ""}`}
                  >
                    {group.messages.map((m) => (
                      <MessageBubble
                        key={m.objectId}
                        message={m}
                        thread={thread}
                        onRefetch={load}
                        onCloseDrawer={onClose}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Reply input — visible even mid-authorization so the owner
                can send a heads-up ("hey Sara, one more note"). Textarea
                for multi-line reads more chat-like than a bare input. */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="border-t border-zinc-100 px-4 py-3 flex items-end gap-2"
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Message ${thread.persona.name}…`}
                rows={1}
                className="flex-1 resize-none border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 max-h-32"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="p-2 rounded-lg bg-zinc-900 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 flex-shrink-0"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// Renders a single message. Branches on `kind` — most messages are
// plain text bubbles; the leaf_host_pay_card kind renders as an
// inline LeafHostPayCard component (interactive checkboxes +
// capacity + Confirm). Fee-disclaimer gets amber emphasis so the
// spec §4 "full weight" requirement is honored inside a chat context.
function MessageBubble({
  message,
  thread,
  onRefetch,
  onCloseDrawer,
}: {
  message: ThreadMessage;
  thread: ThreadPayload;
  onRefetch: () => void;
  onCloseDrawer: () => void;
}) {
  const isOwner = message.senderRole === "owner";

  if (message.kind === "leaf_host_pay_card") {
    return (
      <LeafHostPayCard
        calendarId={thread.calendarId}
        perPlanRate={thread.perPlanRate}
        maxGroupSize={thread.maxGroupSize}
        turnaroundHours={thread.turnaroundHours}
        personaName={thread.persona.name}
        inFlight={thread.inFlight}
        onAuthorized={() => {
          // Refetch will pull the confirmation message the server
          // posted after the webhook; the owner sees the "great, on it"
          // reply immediately without needing to close and reopen the
          // drawer. Stripe redirect owns the payment flow itself.
          onRefetch();
        }}
        onCloseDrawer={onCloseDrawer}
      />
    );
  }

  if (message.kind === "leaf_host_fee_disclaimer") {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 max-w-[85%]">
        <p className="text-sm text-zinc-900 leading-relaxed whitespace-pre-wrap">
          {message.body}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl px-4 py-2.5 max-w-[85%] ${
        isOwner
          ? "bg-zinc-900 text-white ml-auto"
          : "bg-zinc-100 text-zinc-900"
      }`}
    >
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {message.body}
      </p>
    </div>
  );
}
