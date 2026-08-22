"use client";

import { useEffect, useMemo, useState } from "react";
import Parse from "@/lib/parse-client";
import { Check, Loader2, MessageCircle, X } from "lucide-react";
import type { CalActivePlan, OrgDashboard } from "./types";

// Nudge — host-authored re-engagement text(s), sent server-side (nudgeFollower
// / nudgeFollowers) from the platform number so follower phone numbers are
// never shown to the host. One follower = single mode; several = bulk mode,
// where a literal {name} token in the message becomes each person's first
// name. The server enforces the Pro gate, opt-out, quiet hours, and the shared
// weekly SMS budget; guard errors surface verbatim in this modal, and bulk
// sends report how many people were skipped by per-person guards.

const NUDGE_MAX_CHARS = 500;

type Follower = OrgDashboard["followers"][number];

/** Next upcoming plan on the given calendar (any calendar as fallback).
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

/** The one calendarId every follower in the batch shares, or null. */
function sharedCalendarId(followers: Follower[]): string | null {
  const first = followers[0]?.calendarId || null;
  return followers.every((f) => f.calendarId === first) ? first : null;
}

function buildDefaultMessage(
  dashboard: OrgDashboard,
  followers: Follower[],
  hostFirstName: string,
): string {
  // Sign with the ORG name (what the follower recognizes), and link the
  // calendar's shareId slug — never the /p/<objectId> link, whose random id
  // reads as spam in a personal text. Bulk drafts greet with the {name}
  // token, which the server swaps for each recipient's first name.
  const greetName =
    followers.length === 1
      ? followers[0].name.trim().split(/\s+/)[0] || "there"
      : "{name}";
  const orgName = dashboard.name;
  const from = hostFirstName ? `it's ${hostFirstName} from ${orgName}` : `it's ${orgName}`;
  const calId = sharedCalendarId(followers);
  const shareId =
    dashboard.calendars.find((c) => c.objectId === calId)?.shareId ||
    dashboard.shareId;
  const link = `https://www.os.joinleaf.com/org/${shareId}`;
  // No em dash in the draft — it reads as AI-written in a personal text.
  const next = nextPlanFor(dashboard, calId);
  if (next) {
    const day = planDayLabel(next);
    return `Hey ${greetName}, ${from}. We've got ${next.title}${day ? ` on ${day}` : ""} and would love to see you there: ${link}`;
  }
  return `Hey ${greetName}, ${from}. We'd love to see you at one of our upcoming events: ${link}`;
}

export default function NudgeModal({
  dashboard,
  followers,
  hostFirstName,
  draft,
  onClose,
  onSent,
}: {
  /** Needed only when no `draft` is passed — feeds the default message. */
  dashboard?: OrgDashboard;
  followers: Follower[];
  hostFirstName: string;
  /** Caller-authored default message (e.g. a host-ask); skips the built-in
   *  re-engagement draft entirely. */
  draft?: string;
  onClose: () => void;
  /** Fired once the server confirms: membership ids actually texted + a
   *  ready-made toast line. */
  onSent: (membershipIds: string[], toast: string) => void;
}) {
  const bulk = followers.length > 1;
  const defaultMessage = useMemo(
    () =>
      draft ??
      (dashboard ? buildDefaultMessage(dashboard, followers, hostFirstName) : ""),
    [draft, dashboard, followers, hostFirstName],
  );
  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneText, setDoneText] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const firstName =
    followers[0]?.name.trim().split(/\s+/)[0] || followers[0]?.name || "";
  const title = bulk ? `Nudge ${followers.length} people` : `Nudge ${firstName}`;

  const send = async () => {
    setError(null);
    setSending(true);
    try {
      if (bulk) {
        const result = (await Parse.Cloud.run("nudgeFollowers", {
          membershipIds: followers.map((f) => f.membershipId),
          message: message.trim(),
        })) as { sent: number; skipped: number; sentMembershipIds: string[] };
        const summary =
          result.skipped > 0
            ? `Sent ${result.sent} nudge${result.sent === 1 ? "" : "s"} — ${result.skipped} skipped (opted out or at their weekly text limit)`
            : `Sent ${result.sent} nudge${result.sent === 1 ? "" : "s"}`;
        setDoneText(summary);
        onSent(result.sentMembershipIds, summary);
      } else {
        await Parse.Cloud.run("nudgeFollower", {
          membershipId: followers[0].membershipId,
          message: message.trim(),
        });
        setDoneText(`Text sent to ${firstName}.`);
        onSent([followers[0].membershipId], `Nudge sent to ${firstName}`);
      }
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
            {title}
          </h2>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {doneText ? (
          <div className="px-6 py-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-700" />
            </div>
            <p className="text-sm text-zinc-700">{doneText}</p>
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
                {bulk ? (
                  <>
                    Sent as texts from Leaf&apos;s number — phone numbers stay
                    private, and <span className="font-medium text-zinc-700">{"{name}"}</span>{" "}
                    becomes each person&apos;s first name. Anyone who opted out
                    or already got their weekly text is skipped automatically.
                  </>
                ) : (
                  <>
                    Sent as a text from Leaf&apos;s number — {firstName}&apos;s
                    phone number stays private, and each follower can get at
                    most one nudge a week.
                  </>
                )}
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
                {bulk ? `Send ${followers.length} texts` : "Send text"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
