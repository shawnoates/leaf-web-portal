"use client";

/**
 * The welcome sheet for a placard QR scan (/org/<calendar>?src=<code>).
 *
 * Someone scanned the counter card or table tent at a business, so they're
 * standing in it: "You're at Aura Yoga", then the plans made for that place
 * (leaflets-server offer-placard-ideas.js) as swipe cards, one at a time, with
 * one main action each (spec: venue-sheet-swipe-cards-spec, "Option C").
 *
 * An open idea gets "I'd come" (the calendar's heart) and "Host this"; one a
 * neighbor has hosted stays here with "I'm in" (the calendar's RSVP modal) and
 * "Hosted by …". A tap plays a short animation, then the page's own handler
 * runs (it asks the viewer to follow or sign in first when it needs to, and
 * carries on by itself after). Once it's saved the button gives way to
 * "Got it." for good: the page's interested / RSVP'd state drives it, so a
 * reload shows "Got it." too. This only lays them out.
 * Sits just under z-50 so the follow sheet and the RSVP modal show on top.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";
import { Instrument_Sans } from "next/font/google";
import { Check, Heart, Store, X } from "lucide-react";

const instrumentSans = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

const C = {
  green: "#253A33",
  greenHover: "#16241F",
  ink: "#17191A",
  muted: "#5F6661",
  soft: "#F7F7F4",
  hairline: "#D5D8D5",
  iconTint: "#E4EAE6",
  backdrop: "rgba(23,25,26,0.42)",
  onGreenDivider: "rgba(255,255,255,0.35)",
  onGreenTint: "rgba(255,255,255,0.08)",
  onGreenOutline: "rgba(255,255,255,0.6)",
};

type Idea = {
  id: string;
  title: string;
  description: string;
  date: string | null;
  preferredTime?: string | null;
  /** The plan a neighbor made of this idea, when someone hosted it. */
  eventGroupId?: string | null;
};

/** A hosted idea's plan, as the calendar page knows it. */
export type HostedPlan = { planId: string; hostName: string; count: number; joined: boolean };

/** "THU, OCT 22 · 6:15 PM" ("9 AM" on the hour). The date is stored at noon UTC, so read it in UTC. */
function whenLabel(idea: Idea) {
  const day = idea.date
    ? new Date(idea.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
    : "";
  const m = String(idea.preferredTime || "").match(/^(\d{1,2}):(\d{2})$/);
  const time = m
    ? `${((Number(m[1]) + 11) % 12) + 1}${m[2] === "00" ? "" : `:${m[2]}`} ${Number(m[1]) < 12 ? "AM" : "PM"}`
    : "";
  return [day, time].filter(Boolean).join(" · ");
}

/** "Night owls: Candlelit Flow & Restore" → "Candlelit Flow & Restore". Display only; the stored title stays. */
function cardTitle(title: string) {
  const i = title.indexOf(":");
  if (i <= 0 || i > 40) return title;
  const rest = title.slice(i + 1).trim();
  return rest ? rest[0].toUpperCase() + rest.slice(1) : title;
}

const startKey = (i: Idea) => `${i.date || ""} ${i.preferredTime || "99:99"}`;

function firstName(name: string) {
  return String(name || "").trim().split(/\s+/)[0] || "a neighbor";
}

function countLine(n: number, hosted: boolean) {
  if (hosted) return n === 0 ? "Be the first one in" : n === 1 ? "1 neighbor is in" : `${n} neighbors are in`;
  return n === 0 ? "Be the first to say you’d come" : n === 1 ? "1 neighbor would come" : `${n} neighbors would come`;
}

// The tap animation. "I'd come" reuses the calendar's heart burst
// (heart-fill.json, white in the file; recolored green on the white button).
// "I'm in" has no file yet: until one is dropped in public/motion and named
// here, its check pops in CSS instead.
const HEART_LOTTIE_URL = "/motion/heart-fill.json";
const IM_IN_LOTTIE_URL: string | null = null; // TODO(Shawn): final check/confetti .json
const PLAY_MS = 1000;
const REDUCED_MS = 300;

type LottiePlayer = typeof import("lottie-web/build/player/lottie_light").default;
let lottiePlayer: Promise<LottiePlayer> | null = null;
const lottieData = new Map<string, Promise<unknown>>();
function loadLottie(url: string): Promise<[LottiePlayer, unknown]> {
  lottiePlayer ??= import("lottie-web/build/player/lottie_light").then((m) => m.default);
  if (!lottieData.has(url)) {
    lottieData.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${url} ${r.status}`);
        return r.json();
      }),
    );
  }
  return Promise.all([lottiePlayer, lottieData.get(url)!]);
}

function Burst({ kind }: { kind: "heart" | "check" }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const [failed, setFailed] = useState(false);
  // Reduced motion: no Lottie, just the static heart/check.
  const url = reducedMotion() ? null : kind === "heart" ? HEART_LOTTIE_URL : IM_IN_LOTTIE_URL;

  useEffect(() => {
    if (!url) return;
    let anim: AnimationItem | null = null;
    let cancelled = false;
    loadLottie(url)
      .then(([lottie, data]) => {
        if (cancelled || !boxRef.current) return;
        anim = lottie.loadAnimation({ container: boxRef.current, renderer: "svg", loop: false, autoplay: true, animationData: data as object });
        anim.setSpeed(kind === "heart" ? 2 : 1);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [url, kind]);

  if (!url || failed) {
    const Icon = kind === "heart" ? Heart : Check;
    return (
      <span aria-hidden="true" className="pw-pop pointer-events-none absolute inset-0 flex items-center justify-center">
        <Icon className="h-6 w-6" style={{ color: C.green }} fill={kind === "heart" ? C.green : "none"} strokeWidth={kind === "heart" ? 2 : 3} />
      </span>
    );
  }
  return <span ref={boxRef} aria-hidden="true" className="pw-lottie pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2" />;
}

function reducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export default function PlacardWelcome<T extends Idea>({
  name,
  photoUrl,
  ideas,
  canHost,
  counts,
  interested,
  pending,
  hostedPlan,
  onHeart,
  onRsvp,
  onHost,
  onClose,
}: {
  name: string;
  photoUrl: string | null;
  ideas: T[];
  canHost: boolean;
  counts: Record<string, number>;
  interested: Set<string>;
  pending: Set<string>;
  /** The plan a hosted idea became, or null for an open idea. */
  hostedPlan: (idea: T) => HostedPlan | null;
  onHeart: (id: string) => void;
  onRsvp: (planId: string) => void;
  onHost: (idea: T) => void;
  onClose: () => void;
}) {
  const cards = useMemo(() => [...ideas].sort((a, b) => startKey(a).localeCompare(startKey(b))), [ideas]);
  const n = cards.length;
  const [active, setActive] = useState(0);
  // Cards mid-animation, and which way: the action runs when it ends.
  const [playing, setPlaying] = useState<Record<string, "heart" | "check">>({});
  const [announce, setAnnounce] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tapped = useRef(new Set<string>());
  const doneBefore = useRef<Record<string, boolean>>({});
  const grabY = useRef<number | null>(null);

  // The active card: whichever is mostly in view.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || n < 2) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = cardRefs.current.indexOf(e.target as HTMLDivElement);
          if (i >= 0) setActive(i);
        }
      },
      { root, threshold: 0.6 },
    );
    cardRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const goTo = useCallback((i: number) => {
    const el = cardRefs.current[i];
    if (!el) return;
    el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "nearest", inline: "start" });
  }, []);

  const isDone = (idea: T) => {
    const hp = hostedPlan(idea);
    return hp ? hp.joined : interested.has(idea.id);
  };

  // "Got it." just replaced a button this viewer tapped: say so, and keep focus on the card.
  useEffect(() => {
    cards.forEach((idea, i) => {
      const done = isDone(idea);
      if (done && doneBefore.current[idea.id] === false && tapped.current.has(idea.id)) {
        tapped.current.delete(idea.id);
        setAnnounce(`Got it. ${cardTitle(idea.title)}`);
        cardRefs.current[i]?.focus({ preventScroll: true });
      }
      doneBefore.current[idea.id] = done;
    });
  });

  const tap = (idea: T) => {
    if (playing[idea.id] || pending.has(idea.id)) return;
    const hp = hostedPlan(idea);
    const kind = hp ? "check" : "heart";
    tapped.current.add(idea.id);
    setPlaying((p) => ({ ...p, [idea.id]: kind }));
    window.setTimeout(() => {
      setPlaying((p) => {
        const next = { ...p };
        delete next[idea.id];
        return next;
      });
      if (hp) onRsvp(hp.planId);
      else onHeart(idea.id);
    }, reducedMotion() ? REDUCED_MS : PLAY_MS);
  };

  const single = n === 1;

  return (
    <>
      <div className="fixed inset-0 z-[44]" style={{ background: C.backdrop }} onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="placard-welcome-title"
        className={`${instrumentSans.className} fixed inset-x-0 bottom-0 z-[45] max-h-[90dvh] overflow-y-auto rounded-t-[22px] bg-white shadow-2xl sm:left-1/2 sm:right-auto sm:w-[440px] sm:-translate-x-1/2`}
        style={{ animation: "slideUp 0.3s ease-out", color: C.ink }}
      >
        {/* Grabber: drag it down to close. */}
        <div
          className="flex h-6 cursor-grab touch-none items-start justify-center pt-2"
          onTouchStart={(e) => (grabY.current = e.touches[0].clientY)}
          onTouchEnd={(e) => {
            const from = grabY.current;
            grabY.current = null;
            if (from !== null && e.changedTouches[0].clientY - from > 60) onClose();
          }}
          aria-hidden="true"
        >
          <span className="h-1 w-9 rounded-sm" style={{ background: C.hairline }} />
        </div>

        <div className="flex items-center gap-3 px-5">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" referrerPolicy="no-referrer" className="h-11 w-11 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: C.iconTint }} aria-hidden="true">
              <Store className="h-5 w-5" style={{ color: C.green }} strokeWidth={1.75} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.muted }}>
              You&rsquo;re at
            </p>
            <h2 id="placard-welcome-title" className="truncate font-fm-serif text-[26px] leading-[1.1]">
              {name}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ color: C.muted }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-[22px] flex items-baseline justify-between px-5">
          <p className="text-[15px] font-semibold">Plans neighbors could do here</p>
          {!single && (
            <p className="text-[13px]" style={{ color: C.muted }} aria-hidden="true">
              {active + 1} of {n}
            </p>
          )}
        </div>

        <div
          ref={scrollerRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Plans neighbors could do here"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              goTo(Math.min(n - 1, active + 1));
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              goTo(Math.max(0, active - 1));
            }
          }}
          className="no-scrollbar mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 outline-none [scroll-padding-inline:20px]"
        >
          {cards.map((idea, i) => {
            const on = single || i === active;
            const hp = hostedPlan(idea);
            const count = hp ? hp.count : counts[idea.id] ?? 0;
            const done = isDone(idea);
            const anim = playing[idea.id];
            const dots = Math.min(3, count);
            return (
              <div
                key={idea.id}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${n}: ${cardTitle(idea.title)}`}
                tabIndex={-1}
                onClick={on ? undefined : () => goTo(i)}
                className={`flex shrink-0 snap-start flex-col rounded-[20px] p-5 outline-none transition-colors ${single ? "w-full" : "w-[min(300px,calc(100vw-90px))]"} ${on ? "" : "cursor-pointer"}`}
                style={{ background: on ? C.green : C.soft, color: on ? "#fff" : C.ink }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={on ? { opacity: 0.8 } : { color: C.muted }}>
                  {whenLabel(idea)}
                </p>
                <h3 className="mt-2.5 font-fm-serif text-[30px] leading-[1.1]">{cardTitle(idea.title)}</h3>
                {idea.description && (
                  <p className="mt-2 line-clamp-2 text-[14px] leading-[1.45]" style={on ? { opacity: 0.85 } : { color: C.muted }}>
                    {idea.description}
                  </p>
                )}

                <div className="relative mt-[22px] flex-1">
                  {done ? (
                    <p className="flex h-12 items-center justify-center gap-2 text-[15px] font-semibold">
                      <Check className="h-5 w-5" strokeWidth={2.5} />
                      Got it.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => tap(idea)}
                      disabled={!!anim || pending.has(idea.id)}
                      tabIndex={on ? 0 : -1}
                      className="relative flex h-12 w-full items-center justify-center gap-2 rounded-3xl text-[15px] font-semibold disabled:cursor-default"
                      style={on ? { background: "#fff", color: C.green } : { background: "#fff", color: C.ink, border: `1px solid ${C.hairline}` }}
                    >
                      <span className={`flex items-center gap-2 transition-opacity ${anim ? "opacity-0" : ""}`}>
                        {!hp && <Heart className="h-4 w-4" />}
                        {hp ? "I’m in" : "I’d come"}
                      </span>
                      {anim && <Burst kind={anim} />}
                    </button>
                  )}
                </div>

                {/* Footer strip: who's coming, and hosting. */}
                <div
                  className="-mx-5 -mb-5 mt-5 flex items-center gap-3 rounded-b-[20px] px-5 py-3"
                  style={{
                    borderTop: `1.5px dashed ${on ? C.onGreenDivider : C.hairline}`,
                    background: on ? C.onGreenTint : "transparent",
                  }}
                >
                  {dots > 0 && (
                    <div className="flex shrink-0 -space-x-2" aria-hidden="true">
                      {Array.from({ length: Math.max(2, dots) }).map((_, k) => (
                        <span
                          key={k}
                          className="h-6 w-6 rounded-full border-2"
                          style={{ borderColor: on ? C.green : C.soft, background: ["#C9D6CF", "#E2D3C4", "#D3D9E2"][k] }}
                        />
                      ))}
                    </div>
                  )}
                  <p className="min-w-0 flex-1 text-[13px] leading-snug">{countLine(count, !!hp)}</p>
                  {hp ? (
                    <p className="shrink-0 text-[13px] font-semibold">Hosted by {firstName(hp.hostName)}</p>
                  ) : canHost ? (
                    <button
                      type="button"
                      onClick={() => onHost(idea)}
                      tabIndex={on ? 0 : -1}
                      className="h-11 shrink-0 rounded-full border px-4 text-[14px] font-semibold"
                      style={on ? { borderColor: C.onGreenOutline, color: "#fff" } : { borderColor: C.hairline, color: C.ink }}
                    >
                      Host this
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {!single && (
          <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
            {cards.map((idea, i) => (
              <span
                key={idea.id}
                className="h-1.5 rounded-full transition-all"
                style={{ width: i === active ? 18 : 6, background: i === active ? C.green : C.hairline }}
              />
            ))}
          </div>
        )}

        <div className="px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3 text-center">
          <button type="button" onClick={onClose} className="pw-link min-h-11 text-[15px] font-semibold underline underline-offset-4" style={{ color: C.green }}>
            See the whole calendar
          </button>
        </div>

        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>
      <style>{`
.pw-link:hover{color:${C.greenHover}!important}
.pw-lottie svg path{fill:${C.green};stroke:${C.green}}
.pw-pop{animation:pwPop .3s ease-out}
@keyframes pwPop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}
@media (prefers-reduced-motion: reduce){.pw-pop{animation:none}}
`}</style>
    </>
  );
}
