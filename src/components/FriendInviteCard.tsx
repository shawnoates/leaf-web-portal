"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, MessageSquare, UserPlus } from "lucide-react";
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
// attendee: on the RSVP success screen, "Bring someone?" with two buttons and
// nothing to fill in (2026-11-05): Text a friend opens the guest's own
// Messages app with a group text and their personal link; Copy link copies
// that link. The link is minted as the card appears, so the sms: tap is a real
// <a> (navigating to sms: after an await is flaky on iOS Safari). No name
// means no held seat — the server only holds seats for a named friend.
//
// host: "Send direct invites" in the host's plan tools. Two taps: an optional
// name mints the invite, then an editable note and a real <a href="sms:">.
// Plus each link they've sent and who came in through it.
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

  // Which device decides whether sms: links work. Read after mount so the
  // server render (no navigator) and the first client render agree.
  const [device, setDevice] = useState<"phone" | "mac" | "other">("phone");
  useEffect(() => {
    const ua = navigator.userAgent;
    const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; // iPadOS
    if (/iPhone|iPad|iPod|Android/i.test(ua) || touchMac) setDevice("phone");
    else if (/Macintosh|Mac OS X/.test(ua)) setDevice("mac");
    else setDevice("other");
  }, []);

  // Guests get no name step (design 2026-11-05): the card mints one group
  // link as it appears, so "Text a friend" can be a real <a href="sms:">
  // from the first tap (sms: after an await loses iOS Safari's activation).
  // Cached per plan in this tab so a remount doesn't mint another; the
  // server caps each guest at 10 invites a plan.
  useEffect(() => {
    if (isHost) return;
    const key = `leaf_group_invite_${eventGroupId}`;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached) as CreatedPlanInvite;
        if (parsed?.url && parsed?.smsBody) {
          setInvite(parsed);
          setBody(parsed.smsBody);
          return;
        }
      }
    } catch {
      /* private mode or bad JSON: mint a fresh one */
    }
    let live = true;
    setBusy(true);
    createPlanInvite(eventGroupId, "")
      .then((created) => {
        if (!live) return;
        setInvite(created);
        setBody(created.smsBody);
        try { sessionStorage.setItem(key, JSON.stringify(created)); } catch { /* ignore */ }
        track("plan_invite_created", { planId: eventGroupId, holdsSeat: false, via: variant, group: true });
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : "Couldn't make your link. Try again.");
      })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [isHost, eventGroupId, variant]);

  useEffect(() => {
    if (!isHost) return;
    let live = true;
    listMyPlanInvites(eventGroupId, hostNotificationId).then((rows) => { if (live) setMine(rows); });
    return () => { live = false; };
  }, [isHost, eventGroupId, hostNotificationId, invite]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    // Blank name = a group text: one link for a whole thread, no held seat.
    const name = friendName.trim();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createPlanInvite(eventGroupId, name, hostNotificationId);
      setInvite(created);
      setBody(created.smsBody);
      track("plan_invite_created", { planId: eventGroupId, holdsSeat: created.holdsSeat, via: variant, group: !name });
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
  const heading = isHost ? "Send direct invites" : "Bring someone?";
  const sub = isHost
    ? "A text from you gets more yeses than any link. Leaf writes it; you send it to a friend or a group chat."
    : "Text your friends or a group chat. It's more fun with people you know.";
  const named = friendName.trim();

  if (!isHost) {
    const copyLink = async () => {
      if (!invite) return;
      try {
        await navigator.clipboard.writeText(invite.url);
        setCopied(true);
        markSent("copy");
        window.setTimeout(() => setCopied(false), 1500);
      } catch {
        /* clipboard blocked */
      }
    };
    const btn = "flex-1 flex items-center justify-center gap-2 py-3 text-xs uppercase tracking-wider font-bold rounded-lg";
    const solid = `${btn} bg-zinc-900 text-white`;
    const outline = `${btn} border border-zinc-200 text-zinc-900`;
    // sms: only works on phones and on Macs with Messages. Phones lead with
    // Text a friend; a Mac leads with Copy link and keeps Text second;
    // anywhere else Copy link is the only button (sms: does nothing there).
    const smsFirst = device === "phone";
    const textBtn = device === "other" ? null : invite ? (
      <a href={smsHref(body)} onClick={() => markSent("sms")} className={smsFirst ? solid : outline} style={smsFirst ? accentStyle : undefined}>
        <MessageSquare className="w-4 h-4" /> Text a friend
      </a>
    ) : (
      <span className={`${smsFirst ? solid : outline} opacity-60`} style={smsFirst ? accentStyle : undefined} aria-busy={busy}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />} Text a friend
      </span>
    );
    const copyBtn = (
      <button
        type="button"
        onClick={copyLink}
        disabled={!invite}
        className={`${smsFirst ? outline : solid} disabled:opacity-60`}
        style={smsFirst ? undefined : accentStyle}
      >
        {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
        {copied ? "Copied" : "Copy link"}
      </button>
    );
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
        <div className="flex gap-2">
          {smsFirst ? <>{textBtn}{copyBtn}</> : <>{copyBtn}{textBtn}</>}
        </div>
        {invite?.pointsPerFriend ? (
          <p className="rounded-lg bg-[#eef5f1] px-3 py-2 text-xs text-[#253a33]">
            <span>{invite.pointsUpTo ? "Up to " : ""}<b className="font-bold">{invite.pointsUpTo ? "" : "+"}{invite.pointsPerFriend} pts</b> for each friend who {invite.pointsUpTo ? "comes" : "RSVPs"} through your link</span>
          </p>
        ) : null}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

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
            // Chrome read "Name" as a cardholder name and offered saved cards
            // (2026-10-18), ignoring autocomplete="off"; so no "name" in the
            // placeholder, label or field name, and password managers told to skip it.
            placeholder={limitedSpots ? "Who\u2019s it for? (optional, holds a spot)" : "Who\u2019s it for? (optional)"}
            maxLength={40}
            name="leaf-invite-for"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            aria-label="Who the invite is for, optional"
            className="flex-1 min-w-0 border-b border-zinc-300 py-2 text-base font-light focus:outline-none focus:border-zinc-900 transition-colors"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-1.5 bg-zinc-900 text-white px-4 py-2.5 text-xs uppercase tracking-wider font-bold rounded-lg disabled:opacity-40"
            style={accentStyle}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : named ? "Next" : "Write it"}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          {invite.holdsSeat && invite.expiresAt ? (
            <p className="text-xs font-bold text-emerald-700">
              Spot held for {named} until {holdUntilLabel(invite.expiresAt)}
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
              <MessageSquare className="w-4 h-4" /> {named ? `Text ${named}` : "Open Messages"}
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
              Write another
            </button>
          ) : null}
        </div>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {isHost && mine.length > 0 ? (
        <ul className="divide-y divide-zinc-100 border-t border-zinc-100 pt-1">
          {mine.map((m) => (
            <li key={m.code} className="flex items-center justify-between py-2 text-sm">
              <span className="text-zinc-900 truncate">{m.group ? "Group text" : m.friendName || "Someone"}</span>
              {m.group ? (
                <span className={`text-xs font-bold ${(m.joined ?? 0) > 0 ? "text-emerald-700" : "text-zinc-400"}`}>
                  {(m.joined ?? 0) > 0 ? `${m.joined} in` : "Texted"}
                </span>
              ) : (
                <span className={`text-xs font-bold ${m.status === "claimed" ? "text-emerald-700" : "text-zinc-400"}`}>
                  {STATUS_LABEL[m.status]}
                  {m.status === "open" && m.holdsSeat && m.expiresAt ? ` · held till ${holdUntilLabel(m.expiresAt)}` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
