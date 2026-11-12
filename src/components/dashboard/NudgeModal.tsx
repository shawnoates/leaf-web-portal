"use client";

import { useEffect, useMemo, useState } from "react";
import Parse from "@/lib/parse-client";
import { Check, ChevronDown, Loader2, MessageCircle, X } from "lucide-react";
import type { CalActivePlan, OrgDashboard } from "./types";
import { formatPlanDay, senderNameFor, tidyTitle } from "./types";

// Nudge — host-authored re-engagement text(s), sent server-side (nudgeFollower
// / nudgeFollowers) from the platform number so follower phone numbers are
// never shown to the host. One follower = single mode; several = bulk mode,
// where a literal {name} token in the message becomes each person's first
// name. The server enforces the Pro gate, opt-out, quiet hours, and the shared
// weekly SMS budget; guard errors surface verbatim in this modal, and bulk
// sends report how many people were skipped by per-person guards.

const NUDGE_MAX_CHARS = 500;

type Follower = OrgDashboard["followers"][number];

/** Upcoming plans on the given calendar (every calendar as fallback),
 *  soonest first. activePlans arrives unsorted. */
function upcomingPlansFor(
  dashboard: OrgDashboard,
  calendarId: string | null,
): CalActivePlan[] {
  const scoped = calendarId
    ? dashboard.calendars.filter((c) => c.objectId === calendarId)
    : dashboard.calendars;
  const cals = scoped.length > 0 ? scoped : dashboard.calendars;
  const now = Date.now();
  return cals
    .flatMap((c) =>
      (c.activePlans || []).map((p) => ({ ...p, calendarId: p.calendarId || c.objectId })),
    )
    .filter((p) => new Date(p.date).getTime() > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** The one calendarId every follower in the batch shares, or null. */
function sharedCalendarId(followers: Follower[]): string | null {
  const first = followers[0]?.calendarId || null;
  return followers.every((f) => f.calendarId === first) ? first : null;
}

/** "9 AM Eastern tomorrow" for a server sendAt, in the host's own time too
 *  when they aren't on Eastern. */
function sendTimeLabel(iso?: string | null): string {
  if (!iso) return "9 AM Eastern";
  const at = new Date(iso);
  const dayKey = (d: Date) =>
    d.toLocaleDateString("en-US", { timeZone: "America/New_York" });
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const day =
    dayKey(at) === dayKey(now)
      ? "this morning"
      : dayKey(at) === dayKey(tomorrow)
        ? "tomorrow"
        : at.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long" });
  const local = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const eastern = at.toLocaleTimeString("en-US", {
    timeZone: "America/New_York", hour: "numeric", minute: "2-digit",
  });
  const label = `${day} at 9 AM Eastern`;
  return local === eastern ? label : `${label} (${local} your time)`;
}

function buildDefaultMessage(
  dashboard: OrgDashboard,
  followers: Follower[],
  hostFirstName: string,
  plan: CalActivePlan | null,
): string {
  // Sign with the calendar the link opens (see senderNameFor), and link the
  // calendar's shareId slug — never the /p/<objectId> link, whose random id
  // reads as spam in a personal text. Bulk drafts greet with the {name}
  // token, which the server swaps for each recipient's first name.
  const greetName =
    followers.length === 1
      ? followers[0].name.trim().split(/\s+/)[0] || "there"
      : "{name}";
  const calId = sharedCalendarId(followers);
  const senderName = senderNameFor(dashboard, calId);
  const from = hostFirstName
    ? `it's ${hostFirstName} from ${senderName}`
    : `it's ${senderName}`;
  // A picked plan links to its own calendar page with ?plan=, which opens
  // that plan's detail (and RSVP) straight away.
  const linkCalId = plan?.calendarId || calId;
  const shareId =
    dashboard.calendars.find((c) => c.objectId === linkCalId)?.shareId ||
    dashboard.shareId;
  const base = `https://www.os.joinleaf.com/org/${shareId}`;
  // No em dash in the draft — it reads as AI-written in a personal text.
  if (plan) {
    const day = formatPlanDay(plan.date, plan.timezone);
    return `Hey ${greetName}, ${from}. We've got ${tidyTitle(plan.title)}${day ? ` on ${day}` : ""} and would love to see you there: ${base}?plan=${plan.objectId}`;
  }
  const link = base;
  return `Hey ${greetName}, ${from}. We'd love to see you at one of our upcoming events: ${link}`;
}

export default function NudgeModal({
  dashboard,
  followers,
  hostFirstName,
  draft,
  hostInviteIdeaId,
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
  /** Set on a host-ask: records a durable invite on that idea, which surfaces
   *  as a card on the follower's /me page. Written BEFORE the text and kept
   *  independent of it, so quiet hours or a spent weekly budget delay the
   *  text without losing the ask. Single-recipient only. */
  hostInviteIdeaId?: string;
  onClose: () => void;
  /** Fired once the server confirms: membership ids actually texted + a
   *  ready-made toast line. */
  onSent: (membershipIds: string[], toast: string, scheduledFor?: string | null) => void;
}) {
  const bulk = followers.length > 1;
  // Plan picker — only for the built-in draft (a caller draft is already
  // about something specific). Defaults to the soonest upcoming plan.
  const plans = useMemo(
    () =>
      !draft && dashboard
        ? upcomingPlansFor(dashboard, sharedCalendarId(followers))
        : [],
    [draft, dashboard, followers],
  );
  const [planId, setPlanId] = useState<string>(plans[0]?.objectId || "");
  const draftFor = (id: string) =>
    draft ??
    (dashboard
      ? buildDefaultMessage(
          dashboard,
          followers,
          hostFirstName,
          plans.find((p) => p.objectId === id) || null,
        )
      : "");
  const [message, setMessage] = useState(() => draftFor(planId));
  const pickPlan = (id: string) => {
    setPlanId(id);
    setMessage(draftFor(id));
  };
  const multiCal = new Set(plans.map((p) => p.calendarId)).size > 1;
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
        })) as {
          sent: number;
          scheduled?: number;
          sendAt?: string | null;
          skipped: number;
          sentMembershipIds: string[];
        };
        const done = result.scheduled
          ? `Scheduled ${result.scheduled} nudge${result.scheduled === 1 ? "" : "s"} for ${sendTimeLabel(result.sendAt)}`
          : `Sent ${result.sent} nudge${result.sent === 1 ? "" : "s"}`;
        const summary =
          result.skipped > 0
            ? `${done} — ${result.skipped} skipped (opted out, nudged in the last 7 days, or at their weekly text limit)`
            : done;
        setDoneText(summary);
        onSent(result.sentMembershipIds, summary, result.scheduled ? result.sendAt : null);
      } else {
        // The invite is the ask; the text only carries it. Record it first and
        // let it stand on its own, so a guard that blocks the text (quiet
        // hours, the weekly budget, an opt-out) delays the message instead of
        // dropping the request on the floor.
        if (hostInviteIdeaId) {
          await Parse.Cloud.run("inviteIdeaHost", {
            ideaId: hostInviteIdeaId,
            membershipId: followers[0].membershipId,
          });
        }
        let smsError: string | null = null;
        let scheduledFor: string | null = null;
        let scheduledIso: string | null = null;
        try {
          const r = (await Parse.Cloud.run("nudgeFollower", {
            membershipId: followers[0].membershipId,
            message: message.trim(),
          })) as { scheduled?: boolean; sendAt?: string };
          if (r?.scheduled) {
            scheduledFor = sendTimeLabel(r.sendAt);
            scheduledIso = r.sendAt || null;
          }
        } catch (e) {
          if (!hostInviteIdeaId) throw e;
          smsError = e instanceof Error ? e.message : "the text didn't go through";
        }
        if (smsError) {
          setDoneText(`Asked ${firstName} — it's waiting on their Leaf page. We couldn't text them: ${smsError}`);
          onSent([], `Asked ${firstName}`);
        } else if (scheduledFor) {
          // Asked during quiet hours — the server queued it for 9 AM Eastern.
          setDoneText(
            `${hostInviteIdeaId ? `Asked ${firstName}. ` : ""}Texts don't go out overnight, so ${firstName} gets it ${scheduledFor}.`,
          );
          onSent([followers[0].membershipId], `Nudge to ${firstName} scheduled for ${scheduledFor}`, scheduledIso);
        } else {
          setDoneText(hostInviteIdeaId ? `Asked ${firstName}.` : `Text sent to ${firstName}.`);
          onSent([followers[0].membershipId], hostInviteIdeaId ? `Asked ${firstName}` : `Nudge sent to ${firstName}`);
        }
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
              {plans.length > 0 && (
                <label className="block">
                  <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-zinc-400 block mb-1.5">
                    Invite to
                  </span>
                  <div className="relative">
                    <select
                      value={planId}
                      onChange={(e) => pickPlan(e.target.value)}
                      className="w-full appearance-none pl-3 pr-9 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-900 bg-white"
                    >
                      {plans.map((p) => {
                        const day = formatPlanDay(p.date, p.timezone);
                        const cal = multiCal
                          ? dashboard?.calendars.find((c) => c.objectId === p.calendarId)?.name
                          : null;
                        return (
                          <option key={p.objectId} value={p.objectId}>
                            {tidyTitle(p.title)}
                            {day ? ` · ${day}` : ""}
                            {cal ? ` · ${cal}` : ""}
                          </option>
                        );
                      })}
                      <option value="">No specific plan (calendar link)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <span className="block text-[11px] text-zinc-400 mt-1">
                    The link opens this plan so they can RSVP in one tap.
                    Picking a plan rewrites the message below.
                  </span>
                </label>
              )}
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
