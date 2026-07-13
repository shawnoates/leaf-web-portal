"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Parse from "@/lib/parse-client";
import { Send, Loader2, Sparkles, Check, MessageCirclePlus, MapPin, Wallet } from "lucide-react";
import type { ConciergeMenu } from "./ConciergeMenuCard";
import ConciergeProposalCard, { type ConciergeProposal } from "./ConciergeProposalCard";

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

interface LibraryItem {
  packageId: string;
  title: string;
  description: string;
  whatItIs?: string | null;
  image: string | null;
  category: string | null;
  residentCost: string | null;
  location: string | null;
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
  const [proposals, setProposals] = useState<ConciergeProposal[]>([]);
  const [reviewMode, setReviewMode] = useState<string | null>(null);
  const [showPrefsPrompt, setShowPrefsPrompt] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [responseLabel, setResponseLabel] = useState("Typically replies within a few hours");
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  // Step 2 of the menu flow: after choosing an event, pick a date/time.
  const [timeFor, setTimeFor] = useState<ConciergeMenu["options"][number] | null>(null);
  const [scheduleMode, setScheduleMode] = useState<"pick" | "auto">("pick");
  const [pickDate, setPickDate] = useState("");
  const [pickTime, setPickTime] = useState("");
  // "Something else" → browse the full curated library.
  const [showLibrary, setShowLibrary] = useState(false);
  const [library, setLibrary] = useState<LibraryItem[] | null>(null);
  const [addingPackageId, setAddingPackageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Part A: light stagger of the onboarding burst (greeting → menu-ready →
  // carousel) so it doesn't land as one wall. Only the first small batch.
  const [revealCount, setRevealCount] = useState(0);
  const staggerDoneRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [thread, menuRes, propRes] = await Promise.all([
        Parse.Cloud.run("getConciergeThread", { calendarId }) as Promise<{
          persona: Persona;
          messages: ConciergeMessage[];
          responseTimeLabel?: string;
        }>,
        Parse.Cloud.run("getPendingConciergeMenu", { calendarId }).catch(
          () => ({ menu: null }) as { menu: ConciergeMenu | null }
        ),
        Parse.Cloud.run("getConciergeProposals", { calendarId }).catch(
          () => ({ proposals: [], reviewMode: null }) as { proposals: ConciergeProposal[]; reviewMode: string | null }
        ),
      ]);
      setPersona(thread.persona || { name: "Leaf Concierge", avatarUrl: null });
      setMessages(thread.messages || []);
      if (thread.responseTimeLabel) setResponseLabel(thread.responseTimeLabel);
      setMenu((menuRes as { menu: ConciergeMenu | null }).menu || null);
      setProposals((propRes as { proposals: ConciergeProposal[] }).proposals || []);
      setReviewMode((propRes as { reviewMode: string | null }).reviewMode || null);
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

  // Opening the drawer = engagement — suppresses the bounce welcome email.
  useEffect(() => {
    Parse.Cloud.run("markConciergeEngaged", { calendarId }).catch(() => {});
  }, [calendarId]);

  // Reveal the initial burst with a light 1.2s beat (first small batch only);
  // afterwards everything shows immediately.
  useEffect(() => {
    if (staggerDoneRef.current) {
      setRevealCount(messages.length);
      return;
    }
    if (messages.length === 0) return;
    staggerDoneRef.current = true;
    if (messages.length > 4) {
      setRevealCount(messages.length);
      return;
    }
    let i = 1;
    setRevealCount(1);
    const t = setInterval(() => {
      i += 1;
      setRevealCount(i);
      if (i >= messages.length) clearInterval(t);
    }, 1200);
    return () => clearInterval(t);
  }, [messages]);

  // Keep pinned to the newest message / the menu when it appears.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, menu, revealCount]);

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

  // Step 2 → post: schedule the chosen event with the owner's date/time, or
  // defer to the concierge to pick the best day within 90 days.
  const postPlan = async () => {
    if (!menu || !timeFor || selectingId) return;
    if (scheduleMode === "pick" && !pickDate) return;
    setSelectingId(timeFor.objectId);
    setMenuError(null);
    try {
      await Parse.Cloud.run(
        "selectMenuOption",
        scheduleMode === "auto"
          ? { menuId: menu.menuId, optionId: timeFor.objectId, autoSchedule: true }
          : {
              menuId: menu.menuId,
              optionId: timeFor.objectId,
              scheduledDate: pickDate,
              scheduledTime: pickTime || undefined,
            }
      );
      setMenu(null);
      setTimeFor(null);
      setScheduleMode("pick");
      setPickDate("");
      setPickTime("");
      onMenuResolved?.();
      load();
    } catch (e) {
      setMenuError(e instanceof Error ? e.message : "Couldn't schedule that event.");
    } finally {
      setSelectingId(null);
    }
  };

  // "Something else" — open the full curated library to browse and pick from.
  const openLibrary = async () => {
    setShowLibrary(true);
    setMenuError(null);
    if (library) return; // cached
    try {
      const r: { items: LibraryItem[] } = await Parse.Cloud.run("getConciergeMenuLibrary", { calendarId });
      setLibrary(r.items || []);
    } catch (e) {
      setMenuError(e instanceof Error ? e.message : "Couldn't load the library.");
    }
  };

  // Picking a library item creates it as a menu option, then jumps to step 2.
  const pickLibrary = async (item: LibraryItem) => {
    if (!menu || addingPackageId) return;
    setAddingPackageId(item.packageId);
    setMenuError(null);
    try {
      const r: { option: ConciergeMenu["options"][number] } = await Parse.Cloud.run(
        "addLibraryOptionToMenu",
        { menuId: menu.menuId, packageId: item.packageId }
      );
      setShowLibrary(false);
      setScheduleMode("pick");
      setPickDate("");
      setPickTime("");
      setTimeFor(r.option);
    } catch (e) {
      setMenuError(e instanceof Error ? e.message : "Couldn't add that option.");
    } finally {
      setAddingPackageId(null);
    }
  };

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
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4 shrink-0">
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
          <p className="text-xs text-zinc-400 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Your concierge · {responseLabel.replace(/^Typically/, "typically")}
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="border border-zinc-200 rounded-xl bg-zinc-50/50 p-4 flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-3"
      >
        {loading ? (
          <div className="m-auto flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : messages.length === 0 && !menu && proposals.length === 0 ? (
          <div className="m-auto text-center text-sm text-zinc-400 px-6">
            No messages yet. Say hi to {persona.name} — ideas, questions, dates to plan around.
          </div>
        ) : (
          messages.slice(0, revealCount).map((m) => {
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
        {menu && menu.options.length > 0 && revealCount >= messages.length && (
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
                {timeFor ? (
                  /* ── Step 2 — pick a date, or let us choose the best day ── */
                  <div>
                    <p className="text-xs text-zinc-500 leading-relaxed mb-3">
                      <span className="font-medium text-zinc-700">{timeFor.title}</span> — when
                      should we run it?
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        onClick={() => setScheduleMode("pick")}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                          scheduleMode === "pick" ? "border-zinc-900 bg-zinc-50 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"
                        }`}
                      >
                        I have a date
                      </button>
                      <button
                        onClick={() => setScheduleMode("auto")}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                          scheduleMode === "auto" ? "border-zinc-900 bg-zinc-50 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"
                        }`}
                      >
                        Pick the best day for us
                      </button>
                    </div>

                    {scheduleMode === "pick" ? (
                      <div className="flex flex-col sm:flex-row gap-2 mb-3">
                        <label className="flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Date</span>
                          <input
                            type="date"
                            value={pickDate}
                            onChange={(e) => setPickDate(e.target.value)}
                            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                          />
                        </label>
                        <label className="flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Time <span className="text-zinc-300">(optional)</span></span>
                          <input
                            type="time"
                            value={pickTime}
                            onChange={(e) => setPickTime(e.target.value)}
                            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                          />
                        </label>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 leading-relaxed mb-3 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
                        We&apos;ll find the best day within the next 30 days and confirm it with you
                        here before anything goes out.
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setTimeFor(null); setScheduleMode("pick"); setPickDate(""); setPickTime(""); }}
                        disabled={!!selectingId}
                        className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-50"
                      >
                        Back
                      </button>
                      <button
                        onClick={postPlan}
                        disabled={(scheduleMode === "pick" && !pickDate) || !!selectingId}
                        className="ml-auto inline-flex items-center gap-1.5 bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-60"
                      >
                        {selectingId ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                        ) : (
                          <><Check className="w-3.5 h-3.5" /> {scheduleMode === "auto" ? "Hand it to us" : "Send it over"}</>
                        )}
                      </button>
                    </div>
                  </div>
                ) : showLibrary ? (
                  /* ── Browse the full curated library ── */
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Menu library</p>
                      <button
                        onClick={() => setShowLibrary(false)}
                        className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
                      >
                        Back
                      </button>
                    </div>
                    {!library ? (
                      <div className="py-6 flex justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                      </div>
                    ) : library.length === 0 ? (
                      <p className="text-xs text-zinc-400 py-4">No library items available.</p>
                    ) : (
                      <div className="max-h-72 overflow-y-auto no-scrollbar grid grid-cols-1 sm:grid-cols-2 gap-2 pr-0.5">
                        {library.map((item) => (
                          <button
                            key={item.packageId}
                            onClick={() => pickLibrary(item)}
                            disabled={!!addingPackageId}
                            className="flex gap-2.5 text-left rounded-xl border border-zinc-200 bg-white p-2 hover:border-zinc-400 transition-colors disabled:opacity-60"
                          >
                            {item.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.image} alt={item.title} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                            ) : (
                              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-emerald-50 to-zinc-100 shrink-0 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-emerald-300" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <h5 className="text-sm font-medium text-zinc-900 truncate">{item.title}</h5>
                              <p className="text-xs text-zinc-500 leading-snug line-clamp-2">{item.whatItIs || item.description}</p>
                              {addingPackageId === item.packageId && (
                                <span className="text-[11px] text-zinc-400 flex items-center gap-1 mt-1">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Adding…
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* ── Step 1 — choose an event ── */
                  <>
                    <p className="text-xs text-zinc-500 leading-relaxed mb-1">
                      Pick the event you&apos;d like us to run
                      {menu.calendarName ? ` for ${menu.calendarName}` : ""} — you&apos;ll set the
                      date next.
                    </p>
                    {menu.hostNote && (
                      <p className="text-xs text-zinc-400 italic mb-2">“{menu.hostNote}”</p>
                    )}

                    <div className="mt-2 flex gap-3 overflow-x-auto pb-1 snap-x">
                      {menu.options.map((opt) => (
                        <div
                          key={opt.objectId}
                          className="snap-start shrink-0 w-52 flex flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden"
                        >
                          {opt.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={opt.image} alt={opt.title} className="h-24 w-full object-cover" />
                          ) : (
                            <div className="h-24 w-full bg-gradient-to-br from-emerald-50 to-zinc-100 flex items-center justify-center">
                              <Sparkles className="w-6 h-6 text-emerald-300" />
                            </div>
                          )}
                          <div className="flex flex-1 flex-col p-3">
                            <h5 className="text-sm font-medium text-zinc-900 truncate mb-1">{opt.title}</h5>
                            <p className="text-xs text-zinc-500 leading-snug line-clamp-2 flex-1">
                              {opt.whatItIs || opt.description}
                            </p>
                            <div className="mt-2 space-y-0.5">
                              <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                                <MapPin className="w-3 h-3 shrink-0 text-zinc-400" />
                                <span className="truncate">{opt.location || "On-premise"}</span>
                              </p>
                              {opt.residentCost && (
                                <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                                  <Wallet className="w-3 h-3 shrink-0 text-zinc-400" />
                                  <span className="truncate">{opt.residentCost}</span>
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => { setTimeFor(opt); setMenuError(null); }}
                              disabled={!!selectingId}
                              className="mt-3 inline-flex items-center justify-center gap-1.5 bg-zinc-900 text-white px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-60"
                            >
                              <Check className="w-3.5 h-3.5" /> Choose this
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Something else — browse the full curated library */}
                      <button
                        onClick={openLibrary}
                        className="snap-start shrink-0 w-52 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white p-3 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 transition-colors"
                      >
                        <MessageCirclePlus className="w-6 h-6" />
                        <span className="text-sm font-medium">Something else</span>
                        <span className="text-xs text-zinc-400 text-center leading-snug">Browse the full menu</span>
                      </button>
                    </div>
                  </>
                )}

                {menuError && <p className="mt-2 text-xs text-red-500">{menuError}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Proposals awaiting the owner's approval (materialized by the concierge). */}
        {proposals.map((p) => (
          <div key={p.objectId} className="flex items-start gap-2">
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
              <ConciergeProposalCard
                proposal={p}
                onChanged={() => { load(); onMenuResolved?.(); }}
                onFirstApproval={() => { if (!reviewMode) setShowPrefsPrompt(true); }}
              />
            </div>
          </div>
        ))}

        {/* B7 — first-approval review-mode preference prompt. */}
        {showPrefsPrompt && (
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
                <p className="text-sm text-zinc-800 mb-2.5">
                  Want me to run each one by you like that — or just handle it and keep you posted?
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { mode: "review_each", label: "Run each by me" },
                    { mode: "auto_proceed", label: "Handle it, keep me posted" },
                    { mode: "hands_off", label: "Just handle it" },
                  ].map((o) => (
                    <button
                      key={o.mode}
                      disabled={savingMode}
                      onClick={async () => {
                        setSavingMode(true);
                        try {
                          await Parse.Cloud.run("setConciergeReviewMode", { calendarId, mode: o.mode });
                          setReviewMode(o.mode);
                          setShowPrefsPrompt(false);
                        } catch {
                          /* leave prompt open */
                        } finally {
                          setSavingMode(false);
                        }
                      }}
                      className="text-xs font-medium border border-zinc-300 rounded-lg px-3 py-1.5 text-zinc-700 hover:border-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-50"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowPrefsPrompt(false)} className="mt-2 text-[11px] text-zinc-400 hover:text-zinc-600">
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      <div className="mt-3 flex items-end gap-2 shrink-0">
        <textarea
          ref={textareaRef}
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
