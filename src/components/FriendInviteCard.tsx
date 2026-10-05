"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, MessageSquare, UserPlus } from "lucide-react";
import { track } from "@/lib/track";
import {
  createPlanInvite,
  holdUntilLabel,
  listMyPlanInvites,
  smsHref,
  type CreatedPlanInvite,
  type MyPlanInvite,
} from "@/lib/plan-invite";

// ============================================================================
// Direct invites (server: cloud/plan-invites.js).
//
// attendee: on the RSVP success screen, "Bring someone?" The guest names a
// friend, gets a personal link plus a prefilled text, and sends it from their
// own Messages app. On a plan with limited spots the friend's seat is held
// for 24h (never past 3h before start).
//
// host: "Text people yourself" in the host's plan tools. Same flow in the
// host's voice, plus the list of people they've texted and whether each is in.
//
// Two taps on purpose: the name tap mints the invite, then a real <a href=
// "sms:"> opens Messages. Navigating to sms: right after an await is flaky on
// iOS Safari (it loses the tap's activation), and the second step lets the
// sender edit the note before it goes.
// ============================================================================

type Variant = "attendee" | "host";

const STATUS_LABEL: Record<MyPlanInvite["status"], string> = {
  open: "Texted",
  claimed: "In",
  expired: "Hold expired",
  released: "Released",
};

export default function FriendInviteCard({
  eventGroupId,
  variant = "attendee",
  limitedSpots = false,
  accent,
  hostNotificationId,
  suggestions,
  bare = false,
}: {
  eventGroupId: string;
  variant?: Variant;
  /** Names to offer as one-tap fills (past guests on the checklist's invite row). */
  suggestions?: string[];
  /** Inside a row that already says what this is: no border, no heading. */
  bare?: boolean;
  /** Assigned host on the /t/<id> checklist (no session): their seat id. */
  hostNotificationId?: string;
  /** The plan has a capacity, so the copy can promise a held seat. */
  limitedSpots?: boolean;
  accent?: string;
}) {
  const [friendName, setFriendName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<CreatedPlanInvite | null>(null);
  const [body, setBody] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [mine, setMine] = useState<MyPlanInvite[]>([]);

  const isHost = variant === "host";

  useEffect(() => {
    if (!isHost) return;
    let live = true;
    listMyPlanInvites(eventGroupId, hostNotificationId).then((rows) => { if (live) setMine(rows); });
    return () => { live = false; };
  }, [isHost, eventGroupId, hostNotificationId, invite]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = friendName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createPlanInvite(eventGroupId, name, hostNotificationId);
      setInvite(created);
      setBody(created.smsBody);
      track("plan_invite_created", { planId: eventGroupId, holdsSeat: created.holdsSeat, via: variant });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't make the invite. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const markSent = (how: "sms" | "copy") => {
    if (!invite) return;
    track("plan_invite_sms_opened", { planId: eventGroupId, holdsSeat: invite.holdsSeat, via: variant, how });
    setSent((s) => [...s, friendName.trim()]);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      markSent("copy");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the text is selectable */
    }
  };

  const another = () => {
    setInvite(null);
    setBody("");
    setFriendName("");
    setCopied(false);
  };

  const accentStyle = accent ? { backgroundColor: accent } : undefined;
  const heading = isHost ? "Text people yourself" : "Bring someone?";
  const sub = isHost
    ? "A personal text from you gets more yeses than any link. Name someone and Leaf writes it; you send it from your phone."
    : limitedSpots
      ? "Text a friend. We'll hold a spot for them for 24 hours."
      : "Text a friend a personal invite. It's more fun with someone you know.";

  return (
    <div className={bare ? "text-left space-y-3" : "text-left border border-zinc-200 rounded-xl p-4 space-y-3"}>
      {!bare && (
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0">
          <UserPlus className="w-4 h-4 text-zinc-700" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-zinc-900">{heading}</p>
          <p className="text-xs text-zinc-500 leading-relaxed">{sub}</p>
        </div>
      </div>
      )}

      {!invite && suggestions && suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setFriendName(n.split(/\s+/)[0])}
              className="text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-full px-2.5 py-1"
            >
              {n}
            </button>
          ))}
        </div>
      ) : null}

      {!invite ? (
        <form onSubmit={start} className="flex items-center gap-2">
          <input
            type="text"
            value={friendName}
            onChange={(e) => setFriendName(e.target.value)}
            placeholder="Friend's first name"
            maxLength={40}
            autoComplete="off"
            aria-label="Friend's first name"
            className="flex-1 min-w-0 border-b border-zinc-300 py-2 text-base font-light focus:outline-none focus:border-zinc-900 transition-colors"
          />
          <button
            type="submit"
            disabled={!friendName.trim() || busy}
            className="flex items-center gap-1.5 bg-zinc-900 text-white px-4 py-2.5 text-xs uppercase tracking-wider font-bold rounded-lg disabled:opacity-40"
            style={accentStyle}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Next"}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          {invite.holdsSeat && invite.expiresAt ? (
            <p className="text-xs font-bold text-emerald-700">
              Spot held for {friendName.trim()} until {holdUntilLabel(invite.expiresAt)}
            </p>
          ) : null}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            aria-label="Your text"
            className="w-full text-sm leading-relaxed bg-zinc-50 border border-zinc-200 rounded-lg p-3 focus:outline-none focus:border-zinc-400"
          />
          <div className="flex gap-2">
            <a
              href={smsHref(body)}
              onClick={() => markSent("sms")}
              className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 text-white py-3 text-xs uppercase tracking-wider font-bold rounded-lg"
              style={accentStyle}
            >
              <MessageSquare className="w-4 h-4" /> Text {friendName.trim()}
            </a>
            <button
              type="button"
              onClick={copy}
              className="flex items-center justify-center gap-1.5 border border-zinc-200 px-4 py-3 text-xs uppercase tracking-wider font-bold rounded-lg"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {sent.length > 0 ? (
            <button type="button" onClick={another} className="text-xs font-bold text-zinc-900 underline">
              Invite someone else
            </button>
          ) : null}
        </div>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {isHost && mine.length > 0 ? (
        <ul className="divide-y divide-zinc-100 border-t border-zinc-100 pt-1">
          {mine.map((m) => (
            <li key={m.code} className="flex items-center justify-between py-2 text-sm">
              <span className="text-zinc-900 truncate">{m.friendName || "Someone"}</span>
              <span className={`text-xs font-bold ${m.status === "claimed" ? "text-emerald-700" : "text-zinc-400"}`}>
                {STATUS_LABEL[m.status]}
                {m.status === "open" && m.holdsSeat && m.expiresAt ? ` · held till ${holdUntilLabel(m.expiresAt)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
