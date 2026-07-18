"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import Parse from "@/lib/parse-client";

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

interface ThreadPayload {
  planId: string;
  calendarId: string;
  calendarName: string;
  persona: Persona | null;
  planTitle: string;
  planWhen: string | null;
  messages: ThreadMessage[];
}

// Plan-scoped concierge drawer — "concierge is for a calendar,
// leaf-hosted is by plan". Sibling of LeafHostThread but scoped to a
// single leaf-hosted plan. Reuses the same drawer skeleton (right-side
// desktop, bottom mobile) and the same server ConciergeMessage class
// (with an added `plan` pointer so plan-scoped queries filter
// correctly).
//
// No pay card here — the plan is already paid for by the time this
// thread has anything in it. Just persona messages + owner replies.
export default function LeafHostPlanThread({
  planId,
  onClose,
}: {
  planId: string;
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
      const result = (await Parse.Cloud.run("getLeafHostPlanThread", {
        planId,
      })) as ThreadPayload;
      setThread(result);
      setLoadState("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Couldn't load thread.");
      setLoadState("error");
    }
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

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
      const result = (await Parse.Cloud.run("sendLeafHostPlanMessage", {
        planId,
        body,
      })) as { message: ThreadMessage };
      setThread((prev) =>
        prev ? { ...prev, messages: [...prev.messages, result.message] } : prev,
      );
      setDraft("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't send.");
    } finally {
      setSending(false);
    }
  };

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

  const headerSub = useMemo(() => {
    if (!thread) return "";
    if (!thread.planWhen) return thread.calendarName;
    try {
      const d = new Date(thread.planWhen);
      const pretty = d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      return `${pretty} · ${thread.calendarName}`;
    } catch {
      return thread.calendarName;
    }
  }, [thread]);

  return (
    <div
      className="fixed inset-0 z-50 flex md:justify-end items-end md:items-stretch bg-zinc-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full md:w-[520px] md:max-w-[95vw] rounded-t-2xl md:rounded-none md:rounded-l-2xl md:shadow-2xl relative flex flex-col h-[92vh] md:h-full"
      >
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
                {thread.planTitle}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {thread.persona.name} · {headerSub}
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
              {messageGroups.length === 0 ? (
                <p className="text-sm text-zinc-500 italic text-center pt-8">
                  Your concierge will post here as soon as they start working
                  on this plan.
                </p>
              ) : (
                messageGroups.map((group, gi) => (
                  <div
                    key={gi}
                    className={`flex gap-3 ${group.senderRole === "owner" ? "flex-row-reverse" : ""}`}
                  >
                    {group.senderRole === "concierge" ? (
                      thread.persona?.avatarUrl ? (
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
                        <div
                          key={m.objectId}
                          className={`rounded-2xl px-4 py-2.5 max-w-[85%] ${
                            group.senderRole === "owner"
                              ? "bg-zinc-900 text-white ml-auto"
                              : "bg-zinc-100 text-zinc-900"
                          }`}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {m.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

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
                placeholder={`Message ${thread.persona?.name || "your concierge"}…`}
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
