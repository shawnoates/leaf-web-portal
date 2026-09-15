"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { Check, Loader2, Lock, Repeat, X } from "lucide-react";
import { isSeriesLimitError, NTH_LABELS, WEEKDAY_NAMES } from "@/lib/series";

// Host a series — the owner hands a follower a recurring plan from the
// Community tab (SERIES_HOST_DESIGN_SPEC.md, Path B). Only a title is
// required; the follower fills in the date, place and details from the
// texted link, and it goes live when they publish. The server
// (inviteSeriesHost) enforces eligibility and the Starter plan limit.

const NOTE_MAX = 200;
const TITLE_MAX = 120;

type Repeats = "choose" | "nthWeekday" | "hostPicks";

export type SeriesLimit = { title: string; hostName: string };

export default function SeriesHostModal({
  follower,
  calendarId,
  limit,
  onClose,
  onSent,
  onUpgrade,
}: {
  follower: { objectId: string | null; name: string; calendarId?: string | null };
  calendarId: string;
  /** Set when the calendar is already at its Starter series-host limit —
   *  the sheet opens straight on the upgrade prompt. */
  limit?: SeriesLimit | null;
  onClose: () => void;
  onSent: (seriesId: string, hostUserId: string) => void;
  onUpgrade: () => void;
}) {
  const firstName = follower.name.trim().split(/\s+/)[0] || follower.name || "them";
  const [title, setTitle] = useState("");
  const [repeats, setRepeats] = useState<Repeats>("choose");
  const [nth, setNth] = useState(2);
  const [weekday, setWeekday] = useState(2);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [limitMessage, setLimitMessage] = useState<string | null>(
    limit
      ? `Starter includes one community-hosted series. ${limit.title} is already running with ${limit.hostName}. Upgrade to Growth for unlimited.`
      : null,
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const send = async () => {
    if (!follower.objectId) return;
    setError(null);
    setSending(true);
    try {
      const r = (await Parse.Cloud.run("inviteSeriesHost", {
        calendarId: follower.calendarId || calendarId,
        hostUserId: follower.objectId,
        title: title.trim(),
        freq: repeats === "nthWeekday" ? "monthlyNthWeekday" : repeats === "hostPicks" ? "hostPicks" : undefined,
        nth: repeats === "nthWeekday" ? nth : undefined,
        weekday: repeats === "nthWeekday" ? weekday : undefined,
        note: note.trim() || undefined,
      })) as { planSeriesId: string };
      setDone(true);
      onSent(r.planSeriesId, follower.objectId);
    } catch (e) {
      if (isSeriesLimitError(e)) setLimitMessage(e.message);
      else setError(e instanceof Error ? e.message : "Couldn't send the invite");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/45 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold inline-flex items-center gap-2 text-zinc-900">
            <Repeat className="w-4 h-4 text-zinc-500" />
            Hand {firstName} a recurring plan
          </h2>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {limitMessage ? (
          <>
            <div className="px-6 py-6 space-y-3">
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center">
                <Lock className="w-4 h-4 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-700 leading-relaxed">{limitMessage}</p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-100 bg-zinc-50 rounded-b-2xl">
              <button onClick={onClose} className="text-sm text-zinc-500 px-3 py-2 hover:text-zinc-900 transition-colors">
                Not now
              </button>
              <button
                onClick={onUpgrade}
                className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium px-4 py-2.5 rounded-full transition-colors"
              >
                Upgrade
              </button>
            </div>
          </>
        ) : done ? (
          <div className="px-6 py-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-700" />
            </div>
            <p className="text-sm text-zinc-700">
              Invite sent. {firstName} gets a text to set it up; it goes live when they publish.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 bg-zinc-900 text-white text-xs font-medium rounded-full hover:bg-zinc-800 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              <label className="block">
                <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-zinc-400 block mb-1.5">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={TITLE_MAX}
                  placeholder="Monthly Wine Club"
                  autoFocus
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-900 bg-white"
                />
              </label>

              <div>
                <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-zinc-400 block mb-1.5">Repeats</span>
                <div className="space-y-1.5">
                  {(
                    [
                      ["choose", `Let ${firstName} choose`],
                      ["nthWeekday", "Monthly on a weekday"],
                      ["hostPicks", "Host picks each date"],
                    ] as [Repeats, string][]
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2.5 text-sm text-zinc-800 cursor-pointer">
                      <input type="radio" name="series-repeats" checked={repeats === key} onChange={() => setRepeats(key)} className="accent-zinc-900" />
                      {label}
                    </label>
                  ))}
                </div>
                {repeats === "nthWeekday" && (
                  <div className="mt-2 pl-6 flex items-center gap-2">
                    <select
                      value={nth}
                      onChange={(e) => setNth(parseInt(e.target.value, 10))}
                      className="border border-zinc-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-zinc-900"
                      aria-label="Which week"
                    >
                      {[1, 2, 3, 4, -1].map((n) => (
                        <option key={n} value={n}>{NTH_LABELS[n]}</option>
                      ))}
                    </select>
                    <select
                      value={weekday}
                      onChange={(e) => setWeekday(parseInt(e.target.value, 10))}
                      className="border border-zinc-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-zinc-900"
                      aria-label="Weekday"
                    >
                      {WEEKDAY_NAMES.map((d, i) => (
                        <option key={d} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <label className="block">
                <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-zinc-400 block mb-1.5">Note (optional)</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={NOTE_MAX}
                  placeholder="Love this idea — it's yours to run"
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-900 bg-white"
                />
                <span className="block text-right text-[11px] text-zinc-400 mt-1">{note.length}/{NOTE_MAX}</span>
              </label>

              <p className="text-xs text-zinc-500">
                {firstName} gets a text to set the date, place and details. It goes live when they publish.
              </p>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-100 bg-zinc-50 rounded-b-2xl">
              <button onClick={onClose} className="text-sm text-zinc-500 px-3 py-2 hover:text-zinc-900 transition-colors">
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending || !title.trim() || !follower.objectId}
                className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-medium px-4 py-2.5 rounded-full transition-colors"
              >
                {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                Send invite
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
