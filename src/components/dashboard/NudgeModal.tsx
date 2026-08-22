"use client";

import { useEffect, useMemo, useState } from "react";
import Parse from "@/lib/parse-client";
import { Check, Loader2, MessageCircle, X } from "lucide-react";
import type { CalActivePlan, OrgDashboard } from "./types";

// Nudge — a host-authored re-engagement text to a single follower, sent
// server-side (nudgeFollower) from the platform number so the follower's phone
// number is never shown to the host. The server enforces opt-out, quiet hours,
// and the shared weekly SMS budget; errors from those guards surface verbatim
// in this modal.

const NUDGE_MAX_CHARS = 500;

/** Next upcoming plan on the follower's calendar (any calendar as fallback).
 *  activePlans arrives unsorted, so sort before picking. */
function nextPlanFor(
  dashboard: OrgDashboard,
  calendarId: string | null,
): CalActivePlan | null {
  const scoped = calendarId
    ? dashboard.calendars.filter((c) => c.objectId === calendarId)
    : dashboard.calendars;
  const cals = scoped.length > 0 ? scoped : dashboard.calendars;
  const now = Date.now();
  const plans = cals
    .flatMap((c) => c.activePlans || [])
    .filter((p) => new Date(p.date).getTime() > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return plans[0] || null;
}

/** "Friday" inside the coming week, "Fri, Sep 4" past it — labeled in the
 *  venue's timezone when the plan carries one (mirrors the server's
 *  planDayLabel). */
function planDayLabel(p: CalActivePlan): string {
  try {
    const d = new Date(p.date);
    const farOut = d.getTime() - Date.now() > 6 * 86400000;
    const opts: Intl.DateTimeFormatOptions = farOut
      ? { weekday: "short", month: "short", day: "numeric" }
      : { weekday: "long" };
    if (p.timezone) opts.timeZone = p.timezone;
    return new Intl.DateTimeFormat("en-US", opts).format(d);
  } catch {
    return "";
  }
}

function buildDefaultMessage(
  dashboard: OrgDashboard,
  follower: OrgDashboard["followers"][number],
  hostFirstName: string,
): string {
  const firstName = follower.name.trim().split(/\s+/)[0] || "there";
  const calName = follower.calendarName || dashboard.name;
  const from = hostFirstName ? `it's ${hostFirstName} from ${calName}` : `it's ${calName}`;
  const next = nextPlanFor(dashboard, follower.calendarId);
  if (next) {
    const day = planDayLabel(next);
    return `Hey ${firstName} — ${from}. We've got ${next.title}${day ? ` on ${day}` : ""} and would love to see you there: https://os.joinleaf.com/p/${next.objectId}`;
  }
  const shareId =
    dashboard.calendars.find((c) => c.objectId === follower.calendarId)
      ?.shareId || dashboard.shareId;
  return `Hey ${firstName} — ${from}. We'd love to see you at one of our upcoming events: https://www.os.joinleaf.com/org/${shareId}`;
}

export default function NudgeModal({
  dashboard,
  follower,
  hostFirstName,
  onClose,
  onSent,
}: {
  dashboard: OrgDashboard;
  follower: OrgDashboard["followers"][number];
  hostFirstName: string;
  onClose: () => void;
  onSent: (follower: OrgDashboard["followers"][number]) => void;
}) {
  const defaultMessage = useMemo(
    () => buildDefaultMessage(dashboard, follower, hostFirstName),
    [dashboard, follower, hostFirstName],
  );
  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const firstName = follower.name.trim().split(/\s+/)[0] || follower.name;

  const send = async () => {
    setError(null);
    setSending(true);
    try {
      await Parse.Cloud.run("nudgeFollower", {
        membershipId: follower.membershipId,
        message: message.trim(),
      });
      setDone(true);
      onSent(follower);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the nudge");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/45 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold inline-flex items-center gap-2 text-zinc-900">
            <MessageCircle className="w-4 h-4 text-zinc-500" />
            Nudge {firstName}
          </h2>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-700" />
            </div>
            <p className="text-sm text-zinc-700">
              Text sent to {firstName}.
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
              <p className="text-xs text-zinc-500">
                Sent as a text from Leaf&apos;s number — {firstName}&apos;s
                phone number stays private, and each follower can get at most
                one nudge a week.
              </p>
              <label className="block">
                <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-zinc-400 block mb-1.5">
                  Message
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  maxLength={NUDGE_MAX_CHARS}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-900 bg-white"
                />
                <span className="block text-right text-[11px] text-zinc-400 mt-1">
                  {message.length}/{NUDGE_MAX_CHARS}
                </span>
              </label>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-100 bg-zinc-50 rounded-b-2xl">
              <button
                onClick={onClose}
                className="text-sm text-zinc-500 px-3 py-2 hover:text-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending || !message.trim()}
                className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-medium px-4 py-2.5 rounded-full transition-colors"
              >
                {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                Send text
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
