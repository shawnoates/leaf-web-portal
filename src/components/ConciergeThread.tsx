"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Parse from "@/lib/parse-client";
import { Send, Loader2, Sparkles } from "lucide-react";

interface ConciergeMessage {
  objectId: string;
  senderRole: "owner" | "concierge";
  authorName: string;
  body: string;
  kind: string;
  createdAt: string | null;
}

interface Persona {
  name: string;
  avatarUrl: string | null;
}

/**
 * Owner-side concierge message thread ("Messages" tab). Talks to the
 * ConciergeMessage-backed cloud functions; polls every 8s while mounted for
 * near-real-time replies from the concierge/admin.
 */
export default function ConciergeThread({ calendarId }: { calendarId: string }) {
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [persona, setPersona] = useState<Persona>({ name: "Leaf Concierge", avatarUrl: null });
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r: { persona: Persona; messages: ConciergeMessage[] } = await Parse.Cloud.run(
        "getConciergeThread",
        { calendarId }
      );
      setPersona(r.persona || { name: "Leaf Concierge", avatarUrl: null });
      setMessages(r.messages || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load messages.");
    } finally {
      setLoading(false);
    }
  }, [calendarId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  // Keep pinned to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const r: { message: ConciergeMessage } = await Parse.Cloud.run("sendConciergeMessage", {
        calendarId,
        body,
      });
      setMessages((prev) => [...prev, r.message]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  };

  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden shrink-0">
          {persona.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={persona.avatarUrl} alt={persona.name} className="w-full h-full object-cover" />
          ) : (
            <Sparkles className="w-4 h-4 text-emerald-400" />
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">{persona.name}</h2>
          <p className="text-xs text-zinc-400">Your concierge — replies here</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="border border-zinc-200 rounded-xl bg-zinc-50/50 p-4 h-[26rem] overflow-y-auto flex flex-col gap-3"
      >
        {loading ? (
          <div className="m-auto flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : messages.length === 0 ? (
          <div className="m-auto text-center text-sm text-zinc-400 px-6">
            No messages yet. Say hi to {persona.name} — ideas, questions, dates to plan around.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderRole === "owner";
            return (
              <div key={m.objectId} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    mine
                      ? "bg-zinc-900 text-white rounded-br-sm"
                      : "bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm"
                  }`}
                >
                  {!mine && (
                    <div className="text-[11px] font-semibold text-emerald-600 mb-0.5">{m.authorName}</div>
                  )}
                  <div className="whitespace-pre-wrap">{m.body}</div>
                </div>
                <span className="text-[10px] text-zinc-400 mt-1 px-1">{fmtTime(m.createdAt)}</span>
              </div>
            );
          })
        )}
      </div>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={`Message ${persona.name}…`}
          className="flex-1 resize-none border border-zinc-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-500 max-h-32"
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          className="inline-flex items-center gap-1.5 bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
