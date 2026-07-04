"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Parse from "@/lib/parse-client";
import { Send, Loader2, Sparkles, Check } from "lucide-react";
import type { ConciergeMenu } from "./ConciergeMenuCard";

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
 * Owner-side concierge message thread — the main panel of a concierge
 * calendar. Talks to the ConciergeMessage-backed cloud functions; polls every
 * 8s while mounted for near-real-time replies from the concierge/admin.
 *
 * When there's a pending MonthlyMenu (status awaiting_selection), this month's
 * curated options render inline at the bottom of the thread as a horizontal
 * carousel the owner picks from — selecting locks the menu and publishes the
 * event to their calendar (server: selectMenuOption). `onMenuResolved` lets the
 * parent refresh the dashboard so the new event lands in Active Plans.
 */
export default function ConciergeThread({
  calendarId,
  onMenuResolved,
}: {
  calendarId: string;
  onMenuResolved?: () => void;
}) {
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [persona, setPersona] = useState<Persona>({ name: "Leaf Concierge", avatarUrl: null });
  const [menu, setMenu] = useState<ConciergeMenu | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [thread, menuRes] = await Promise.all([
        Parse.Cloud.run("getConciergeThread", { calendarId }) as Promise<{
          persona: Persona;
          messages: ConciergeMessage[];
        }>,
        Parse.Cloud.run("getPendingConciergeMenu", { calendarId }).catch(
          () => ({ menu: null }) as { menu: ConciergeMenu | null }
        ),
      ]);
      setPersona(thread.persona || { name: "Leaf Concierge", avatarUrl: null });
      setMessages(thread.messages || []);
      setMenu((menuRes as { menu: ConciergeMenu | null }).menu || null);
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

  // Keep pinned to the newest message / the menu when it appears.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, menu]);

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

  const selectOption = async (optionId: string) => {
    if (!menu || selectingId) return;
    setSelectingId(optionId);
    setMenuError(null);
    try {
      await Parse.Cloud.run("selectMenuOption", { menuId: menu.menuId, optionId });
      setMenu(null);
      onMenuResolved?.();
      load();
    } catch (e) {
      setMenuError(e instanceof Error ? e.message : "Couldn't select that option.");
    } finally {
      setSelectingId(null);
    }
  };

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : null;

  const monthLabel = menu?.month
    ? new Date(`${menu.month}-01T12:00:00Z`).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "This month";
  const deadlineLabel = menu?.vetoDeadline
    ? new Date(menu.vetoDeadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const me = Parse.User.current() as any;
  const myAvatar =
    me?.get?.("profilePicture")?.url?.() ||
    me?.get?.("profilePhoto")?.url?.() ||
    null;

  return (
    <div className="w-full">
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
        className="border border-zinc-200 rounded-xl bg-zinc-50/50 p-4 h-[30rem] overflow-y-auto flex flex-col gap-3"
      >
        {loading ? (
          <div className="m-auto flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : messages.length === 0 && !menu ? (
          <div className="m-auto text-center text-sm text-zinc-400 px-6">
            No messages yet. Say hi to {persona.name} — ideas, questions, dates to plan around.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderRole === "owner";
            const avatarUrl = mine ? myAvatar : persona.avatarUrl;
            return (
              <div
                key={m.objectId}
                className={`flex items-start gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}
              >
                <div className="w-8 shrink-0">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt={m.authorName} className="w-8 h-8 rounded-full object-cover" />
                  ) : mine ? (
                    <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600 text-xs font-bold">
                      {(m.authorName || "?").charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                    </div>
                  )}
                </div>
                <div className={`max-w-[75%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <span className="text-[11px] text-zinc-400 mb-0.5 px-1">{m.authorName}</span>
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm ${
                      mine
                        ? "bg-zinc-900 text-white"
                        : "bg-white border border-zinc-200 text-zinc-900"
                    }`}
                  >
                    <span className="whitespace-pre-wrap break-words">{m.body}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Pending menu — inline carousel the owner picks from, styled as a
            rich concierge-side message. */}
        {menu && menu.options.length > 0 && (
          <div className="flex items-start gap-2">
            <div className="w-8 shrink-0">
              {persona.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={persona.avatarUrl} alt={persona.name} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] text-zinc-400 mb-0.5 px-1 block">{persona.name}</span>
              <div className="rounded-2xl border border-zinc-200 bg-white p-3.5">
                <div className="flex items-start justify-between gap-3 mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <h4 className="text-sm font-semibold text-zinc-900">
                      Your {monthLabel} menu is ready
                    </h4>
                  </div>
                  {deadlineLabel && (
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">
                      Choose by {deadlineLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed mb-1">
                  {menu.autonomyMode === "approve"
                    ? "Pick the event you'd like us to run"
                    : "We'll run the highlighted pick unless you choose another"}
                  {menu.calendarName ? ` for ${menu.calendarName}` : ""}.
                </p>
                {menu.hostNote && (
                  <p className="text-xs text-zinc-400 italic mb-2">“{menu.hostNote}”</p>
                )}

                <div className="mt-2 flex gap-3 overflow-x-auto pb-1 snap-x">
                  {menu.options.map((opt) => {
                    const isPreselected = opt.objectId === menu.preselectedOptionId;
                    const busy = selectingId === opt.objectId;
                    const date = fmtDate(opt.suggestedDate);
                    return (
                      <div
                        key={opt.objectId}
                        className={`snap-start shrink-0 w-52 flex flex-col rounded-xl border bg-white overflow-hidden ${
                          isPreselected ? "border-emerald-400 ring-1 ring-emerald-400" : "border-zinc-200"
                        }`}
                      >
                        {opt.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={opt.image} alt={opt.title} className="h-24 w-full object-cover" />
                        ) : (
                          <div className="h-24 w-full bg-gradient-to-br from-zinc-100 to-zinc-200" />
                        )}
                        <div className="flex flex-1 flex-col p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <h5 className="text-sm font-medium text-zinc-900 truncate">{opt.title}</h5>
                            {isPreselected && (
                              <span className="shrink-0 text-[8px] font-bold uppercase tracking-widest bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">
                                Pick
                              </span>
                            )}
                          </div>
                          {(date || opt.suggestedTime) && (
                            <p className="text-xs text-emerald-600 mb-1">
                              {[date, opt.suggestedTime].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          <p className="text-xs text-zinc-500 leading-snug line-clamp-3 flex-1">
                            {opt.description}
                          </p>
                          <button
                            onClick={() => selectOption(opt.objectId)}
                            disabled={!!selectingId}
                            className="mt-3 inline-flex items-center justify-center gap-1.5 bg-zinc-900 text-white px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-60"
                          >
                            {busy ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scheduling…
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" /> Choose this
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {menuError && <p className="mt-2 text-xs text-red-500">{menuError}</p>}
              </div>
            </div>
          </div>
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
