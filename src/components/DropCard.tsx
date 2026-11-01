"use client";

/**
 * A Drop: a curated experience Leaf drops on a calendar. Counts down to when
 * spots open (tap Notify me to get a text), then first come, first served for
 * a small attendance-guarantee fee, paid on the plan page (/p/<id>). When
 * it's full, Join the waitlist opens the Drop's popup to save a card (signed
 * in only): if a spot opens, the next in line is charged and gets the pass.
 *
 * "card" is the card above the hero on /me; "band" is the calendar page's
 * featured-band design (the "Around the city" strip under the header), where
 * it stands in for the Drop's plain plan row. /me also gets DropPopup, once per Drop, when one on
 * a calendar they follow goes live.
 *
 * Only followers of the calendar get the texts (the server refuses anyone
 * else). On a calendar page, beforeNotify runs the page's follow gate first
 * and calls go once they follow, with the phone they followed with.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, Loader2, Ticket } from "lucide-react";
import Parse from "@/lib/parse-client";
import { useCountdown } from "@/app/o/m/[token]/FreeNightCountdown";
import { getVerifiedUserCookie } from "@/lib/verified-user";
import { dropGets, dropWhen, interestCookie, money, sendDropInterest, type Drop } from "@/lib/drops";
import DropPopup, { Popup } from "@/components/DropPopup";

function countdownLabel(left: number) {
  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

type BeforeNotify = (go: (phone?: string) => void) => void;

export default function DropCard({
  drop,
  variant = "card",
  beforeNotify,
}: {
  drop: Drop;
  variant?: "card" | "band";
  beforeNotify?: BeforeNotify;
}) {
  const left = useCountdown(drop.opensAt, drop.status === "scheduled");
  // The countdown ran out while the page was open: it's open now.
  const status = drop.status === "scheduled" && left === null ? "open" : drop.status;
  const [notified, setNotified] = useState(drop.notified);
  const [waitlisted, setWaitlisted] = useState(drop.waitlisted);
  const [joining, setJoining] = useState(false);
  const [askPhone, setAskPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waitlist = status === "sold_out";
  const tap = async (typedPhone?: string) => {
    const signedIn = Boolean(Parse.User.current());
    let followedWith = "";
    try {
      followedWith = localStorage.getItem("leaf_follower_phone") || "";
    } catch {}
    const usePhone = typedPhone || getVerifiedUserCookie()?.phone || followedWith;
    if (!signedIn && usePhone.replace(/\D/g, "").length < 10) {
      setAskPhone(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendDropInterest("notifyMeForDrop", drop.id, usePhone);
      setNotified(true);
      setAskPhone(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const onTap = () => (beforeNotify ? beforeNotify((p) => void tap(p)) : void tap());

  const gets = dropGets(drop);
  const value = drop.valueCents > drop.feeCents ? `${money(drop.valueCents)} value` : "";
  const live = (status === "scheduled" || status === "open") && !drop.pass;
  const spots =
    !live || drop.spotsLeft === null ? null : drop.spotsLeft === 1 ? "1 left" : `${drop.spotsLeft} left`;

  const action = (() => {
    if (drop.pass?.status === "paid" && drop.pass.token) {
      return (
        <Link href={`/drop/${drop.pass.token}`} className="drop-btn drop-btn-dark">
          <Ticket className="w-3.5 h-3.5" /> You&apos;re in · View pass
        </Link>
      );
    }
    if (status === "cancelled" || drop.pass?.status === "cancelled") {
      return (
        <span className="text-sm text-white/70">
          Called off{drop.pass?.refundedCents ? ` · ${money(drop.pass.refundedCents)} refunded` : ""}
        </span>
      );
    }
    if (status === "done") return null;
    if (status === "open") {
      return (
        <Link href={`/p/${drop.id}`} className="drop-btn drop-btn-accent">
          Hold your spot · {money(drop.feeCents)}
        </Link>
      );
    }
    if (waitlist && !waitlisted) {
      // Saving a card needs an account: signed-out visitors sign in on /me,
      // where the Drop shows again.
      return Parse.User.current() ? (
        <button onClick={() => setJoining(true)} className="drop-btn drop-btn-dark">Join the waitlist</button>
      ) : (
        <Link href="/me" className="drop-btn drop-btn-dark">Sign in to join the waitlist</Link>
      );
    }
    if ((waitlist && waitlisted) || (!waitlist && notified)) {
      return (
        <span className="drop-btn drop-btn-quiet" aria-live="polite">
          <Check className="w-3.5 h-3.5" /> {waitlist ? "On the waitlist" : "We'll text you"}
        </span>
      );
    }
    if (askPhone) {
      return (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void tap(phone);
          }}
        >
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus
            placeholder="Your phone"
            aria-label="Phone number to text when it opens"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-36 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
          />
          <button type="submit" disabled={busy} className="drop-btn drop-btn-dark">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Text me"}
          </button>
        </form>
      );
    }
    return (
      <button onClick={onTap} disabled={busy} className="drop-btn drop-btn-dark">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
        Notify me
      </button>
    );
  })();

  // One short status, opposite the eyebrow.
  const statusLine =
    drop.pass?.status === "paid" ? null
      : status === "scheduled" && left !== null ? (
        <span className="tabular-nums" role="timer" aria-live="off">Opens in {countdownLabel(left)}</span>
      )
      : status === "open" ? <span className="drop-live"><span className="drop-dot" aria-hidden />Live{spots ? ` · ${spots}` : ""}</span>
      : status === "sold_out" ? <span>Full</span>
      : null;

  const joinSheet = joining && (
    <Popup
      drop={{ ...drop, status: "sold_out", waitlisted }}
      onClose={() => {
        setJoining(false);
        // Their card step may have finished: show the saved state.
        Parse.Cloud.run("getActiveDropForCalendar", { calendarId: drop.calendar?.id, cookie: interestCookie() })
          .then((r: { drop?: Drop | null }) => r?.drop?.id === drop.id && setWaitlisted(Boolean(r.drop.waitlisted)))
          .catch(() => {});
      }}
    />
  );

  if (variant === "band") {
    // Same build as the page's "Around the city" band: 122px, black, the
    // media in a 232px column, chips over a one-line title, the action right.
    const when = drop.startsAt ? new Date(drop.startsAt) : null;
    const dateLabel = when
      ? `${when.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} · ${when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
      : "";
    return (
      <article
        aria-label={`Drop: ${drop.title}`}
        className="drop-band grid grid-cols-1 sm:grid-cols-[232px_1fr] sm:h-[122px] overflow-hidden bg-[#0a0a0a]"
        style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
      >
        <style>{STYLES}</style>
        <div className="relative h-40 sm:h-[122px] bg-[#161616]">
          {drop.videoUrl ? (
            <video
              ref={(el) => {
                if (el) el.muted = true;
              }}
              src={drop.videoUrl}
              poster={drop.imageUrl || undefined}
              autoPlay
              muted
              loop
              playsInline
              aria-hidden
              className="w-full h-full object-cover"
            />
          ) : drop.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={drop.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : null}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 px-5 py-[14px] min-w-0">
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-3 text-[9px] leading-none font-medium uppercase tracking-[0.16em] whitespace-nowrap">
              <span className="border border-[#3a3a3a] px-[7px] py-1 text-white">
                <span aria-hidden>◆</span> Leaf drop
              </span>
              {dateLabel && <span className="text-[#8f8f8a]">{dateLabel}</span>}
              {statusLine && <span className="drop-band-status text-[#7fd6a8]">{statusLine}</span>}
            </div>
            <h3 className="text-[21px] leading-[1.1] font-normal tracking-[-0.01em] text-white truncate">
              {drop.title}
            </h3>
            <div className="flex gap-2.5 text-xs leading-[1.4] overflow-hidden">
              {gets && <span className="shrink-0 whitespace-nowrap text-[#d9d9d5]">{gets}</span>}
              <span className="flex-1 min-w-0 truncate text-[#6d6d68]">
                {["Hosted by Leaf", drop.place].filter(Boolean).join(" · ")}
              </span>
            </div>
          </div>
          <div className="flex-none flex flex-col items-start sm:items-end gap-1.5 whitespace-nowrap">
            {action}
            {error ? (
              <span className="text-[10px] text-red-300">{error}</span>
            ) : live ? (
              <span className="text-[10px] text-[#6d6d68]">First come, first served</span>
            ) : null}
          </div>
        </div>
        {joinSheet}
      </article>
    );
  }

  return (
    <section aria-label={`Drop: ${drop.title}`} className="drop drop-card">
      <style>{STYLES}</style>
      <div className="flex items-center justify-between gap-2">
        <span className="drop-eyebrow">
          <span aria-hidden>◆</span> Drop{drop.calendar?.name ? ` · ${drop.calendar.name}` : ""}
        </span>
        {statusLine && <span className="drop-status">{statusLine}</span>}
      </div>
      <h2 className="drop-title">{drop.title}</h2>
      <p className="text-xs text-white/60">{[dropWhen(drop.startsAt), drop.place].filter(Boolean).join(" · ")}</p>
      <div className="drop-foot">
        {(drop.includes || value) && (
          <span className="drop-gets">
            {drop.includes}
            {drop.includes && value && <br />}
            {value}
          </span>
        )}
        {action}
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {joinSheet}
    </section>
  );
}

/**
 * /me: the viewer's Drops (calendars they follow, passes they hold), plus the
 * once-per-Drop popup when one goes live. Nothing when there are none.
 */
export function MyDrops({ className = "" }: { className?: string }) {
  const [drops, setDrops] = useState<Drop[]>([]);
  useEffect(() => {
    Parse.Cloud.run("getMyDrops")
      .then((r: { drops?: Drop[] }) => setDrops(r?.drops || []))
      .catch(() => setDrops([]));
  }, []);
  if (drops.length === 0) return null;
  const popup = <DropPopup drops={drops} />;
  if (drops.length === 1) {
    return (
      <div className={className}>
        <DropCard drop={drops[0]} />
        {popup}
      </div>
    );
  }
  return (
    <div className={`${className} flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-1 px-1`}>
      {drops.map((d) => (
        <div key={d.id} className="snap-start shrink-0 w-[88%] sm:w-[70%]">
          <DropCard drop={d} />
        </div>
      ))}
      {popup}
    </div>
  );
}

/**
 * A calendar page: its next Drop, as a featured band under the header. onDrop hands the
 * page the Drop's id so its plan list skips the same plan.
 */
export function CalendarDrop({
  calendarId,
  beforeNotify,
  onDrop,
  className = "",
}: {
  calendarId: string;
  beforeNotify?: BeforeNotify;
  onDrop?: (id: string | null) => void;
  className?: string;
}) {
  const [drop, setDrop] = useState<Drop | null>(null);
  useEffect(() => {
    if (!calendarId) return;
    Parse.Cloud.run("getActiveDropForCalendar", { calendarId, cookie: interestCookie() })
      .then((r: { drop?: Drop | null }) => setDrop(r?.drop || null))
      .catch(() => setDrop(null));
  }, [calendarId]);
  const shown = drop && drop.status !== "done" ? drop : null;
  useEffect(() => {
    onDrop?.(shown?.id ?? null);
  }, [shown?.id, onDrop]);
  if (!shown) return null;
  return (
    <div className={className}>
      <DropCard drop={shown} variant="band" beforeNotify={beforeNotify} />
    </div>
  );
}

// Spacing is gap, not margin: /me's `.leafme p { margin: 0 }` reset outranks
// Tailwind's margin utilities.
const STYLES = `
.drop { background: #131714; color: #fff; border-radius: 16px; }
.drop-card { display: flex; flex-direction: column; gap: 4px; padding: 18px 20px 20px; }
.drop-eyebrow { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; font-weight: 700; color: #C9F27B; }
.drop-status { font-size: 11px; font-weight: 500; color: #C9F27B; white-space: nowrap; }
.drop-live { display: inline-flex; align-items: center; gap: 6px; }
.drop-dot { width: 6px; height: 6px; border-radius: 3px; background: #C9F27B; }
.drop-title { font-size: 20px; line-height: 1.3; font-weight: 500; color: #fff; padding-top: 2px; }
.drop-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 12px; }
.drop-gets { font-size: 12px; line-height: 1.4; color: rgba(255,255,255,.7); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.drop-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 11px 16px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }
.drop-btn:disabled { opacity: .6; }
.drop-btn-dark { background: #fff; color: #131714; }
.drop-btn-accent { background: #C9F27B; color: #131714; }
.drop-btn-quiet { background: rgba(255,255,255,.12); color: #fff; }
/* The calendar page's featured band: square white buttons in small caps, like its Host this. */
.drop-band .drop-btn { border-radius: 0; padding: 9px 16px; font-size: 10px; line-height: 1; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; }
.drop-band .drop-btn svg { width: 12px; height: 12px; }
.drop-band .drop-btn-dark, .drop-band .drop-btn-accent { background: #fff; color: #0a0a0a; }
.drop-band .drop-btn-dark:hover, .drop-band .drop-btn-accent:hover { background: #dcdcd8; }
.drop-band .drop-btn-quiet { background: transparent; border: 1px solid #3a3a3a; color: #7fd6a8; }
.drop-band input { border-radius: 0; font-size: 12px; padding: 7px 10px; }
.drop-band-status .drop-dot { background: #7fd6a8; }
`;
