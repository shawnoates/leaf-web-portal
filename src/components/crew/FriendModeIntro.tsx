"use client";

/**
 * The Friend Mode intro pop-up, for people who haven't turned it on.
 *
 * Shown at most once a month per browser, on the calendar dashboard (owner,
 * Friend Mode off) and on /me (owns a calendar, in no crew) — where it takes
 * the slot the needs-a-host popup would otherwise use. Both surfaces share
 * one stamp, so nobody sees it twice in a month.
 *
 * Phone: a bottom sheet with the media across the top. Desktop (lg+): a
 * 920×620 split — media on the left, the dark Friend Mode panel on the right.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Check, MessageCircle, RefreshCw, X } from "lucide-react";
import { FriendModeMark } from "@/components/crew/FriendModeGlyphs";
import { track } from "@/lib/track";

const STAMP_KEY = "leaf_fm_intro_shown";
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** The looping clip of a real crew. A still stands in until the gif lands. */
const INTRO_MEDIA_SRC = "/photo-row/restaurant-dinner.jpg";

/** True when the intro hasn't been shown in the last 30 days. */
export function friendModeIntroDue(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STAMP_KEY);
    return !raw || Date.now() - Number(raw) > MONTH_MS;
  } catch {
    return false;
  }
}

/** Stamp it the moment it shows: closing without answering still counts. */
export function stampFriendModeIntro() {
  try { localStorage.setItem(STAMP_KEY, String(Date.now())); } catch { /* ignore */ }
}

/** Where a Friend Mode setup started; logged on the funnel events and stored on the calendar. */
export type FriendModeSource = "me" | "dashboard" | "ios";

export default function FriendModeIntro({
  onClose,
  onStart,
  startHref,
  startLabel = "Turn on Friend Mode",
  source,
}: {
  onClose: () => void;
  /** The primary button's action; `startHref` makes it a link instead. */
  onStart?: () => void;
  startHref?: string;
  startLabel?: string;
  source: FriendModeSource;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    track("fm_intro_shown", { src: source });
    // Once per open; the source doesn't change while it's up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const start = () => {
    track("fm_intro_cta", { src: source });
    onStart?.();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const cta = "inline-flex h-[52px] items-center justify-center rounded-full bg-fm-ink px-6 text-base font-semibold text-fm-canvas hover:bg-white";

  return (
    <div className="fm fixed inset-0 z-[60] flex items-end justify-center bg-fm-canvas/80 sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fm-intro-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-fm-canvas font-fm-sans text-fm-ink shadow-[0_40px_120px_rgba(0,0,0,0.5)] outline-none sm:max-w-[560px] sm:rounded-[32px] lg:h-[620px] lg:max-h-none lg:max-w-[920px] lg:flex-row"
      >
        {/* Media */}
        <div className="relative h-[220px] shrink-0 bg-fm-surface lg:h-auto lg:w-[380px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={INTRO_MEDIA_SRC} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-fm-canvas/10 via-transparent to-fm-canvas/90 lg:from-transparent lg:via-transparent lg:via-55% lg:to-fm-canvas/85" />
          <span aria-hidden className="absolute left-1/2 top-2.5 h-1 w-10 -translate-x-1/2 rounded-full bg-fm-ink/70 lg:hidden" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-fm-canvas/60 text-fm-ink lg:hidden"
          >
            <X size={18} aria-hidden />
          </button>
          {/* A text from Leaf, as the crew would get it */}
          <div className="absolute inset-x-5 bottom-4 flex flex-col gap-1.5 lg:inset-x-6 lg:bottom-6 lg:gap-2">
            <span className="font-fm-mono text-[10px] uppercase tracking-[0.08em] text-fm-muted lg:text-[11px]">Leaf · Thu 4:12 pm</span>
            <div className="max-w-[280px] self-start rounded-[18px] rounded-bl-md bg-fm-ink px-3.5 py-2.5 text-sm leading-snug text-fm-canvas lg:max-w-[300px] lg:rounded-[20px] lg:rounded-bl-md lg:px-4 lg:py-3 lg:text-[15px]">
              Thursday at Lilia is booked. 8pm, 5 in. See you there.
            </div>
          </div>
        </div>

        {/* Copy */}
        <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 pb-7 pt-[22px] lg:gap-6 lg:px-11 lg:pb-9 lg:pt-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FriendModeMark width={36} />
              <span className="font-fm-mono text-[11px] uppercase tracking-[0.08em] text-fm-muted">Friend Mode</span>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2.5 -mt-2 hidden h-11 w-11 items-center justify-center rounded-full text-fm-muted hover:text-fm-ink lg:flex">
              <X size={20} aria-hidden />
            </button>
          </div>

          <div className="flex flex-col gap-2.5 lg:gap-3.5">
            <h2 id="fm-intro-title" className="m-0 font-fm-serif text-[34px] font-normal leading-[1.02] lg:text-[40px] lg:leading-[1.05]">
              <span className="lg:whitespace-nowrap">Nights out with <span className="text-fm-accent">your</span> people,</span>
              <br className="hidden lg:block" />{" "}
              <span className="italic text-fm-ink-2">planned for you.</span>
            </h2>
            <p className="m-0 text-[15px] leading-normal text-fm-ink-2 lg:text-base">
              Pick your crew and how often. Every time it comes around, Leaf finds a night that works, picks a spot from your list, and texts everyone. You just show up.
            </p>
          </div>

          <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:gap-3">
            {([
              [RefreshCw, "Every week to every other month. You pick."],
              [Check, "Asks everyone which nights work, then picks the spot"],
              [MessageCircle, "Texts the crew, so nobody opens an app"],
            ] as const).map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-2.5 text-sm lg:gap-3 lg:text-[15px]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-fm-line-dim bg-fm-surface">
                  <Icon size={16} className="text-fm-accent" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <div className="mt-auto flex flex-col gap-1.5 lg:gap-3.5">
            <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-2.5">
              {startHref ? (
                <Link href={startHref} onClick={() => track("fm_intro_cta", { src: source })} className={cta}>{startLabel}</Link>
              ) : (
                <button type="button" onClick={start} className={cta}>{startLabel}</button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-full text-sm font-medium text-fm-muted hover:text-fm-ink lg:h-[52px] lg:border lg:border-fm-line lg:px-5 lg:text-[15px] lg:text-fm-ink"
              >
                Not now
              </button>
            </div>
            <p className="m-0 hidden text-xs text-fm-muted lg:block">Included in your plan. Nobody is texted until you invite them.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
