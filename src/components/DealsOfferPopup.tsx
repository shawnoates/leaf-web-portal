"use client";

/**
 * The Club Neighbor pop-up ($99 a year, shown as $8.25 a month). Club
 * Neighbor is the members' name for what the code calls the deals offer.
 *
 * Pops up on its own only for followers of a calendar an admin has turned it
 * on for: the server sends `dealsOffer` on /me and on that calendar's page,
 * and sends nothing once the person has asked to join. Shown that way at most
 * once a month per browser; both surfaces share one stamp. The Join button on
 * a merchant-hosted night opens it for anyone.
 *
 * The button goes to Stripe's hosted checkout (createClubNeighborCheckout):
 * $99 a year. No card is ever typed on this site. They come back with
 * ?club=joined, and ClubNeighborReturn (below) says welcome.
 *
 * Same shape as the Friend Mode intro: a bottom sheet on a phone, a 920px
 * split on desktop with the photo on the left.
 */

import { useEffect, useRef, useState } from "react";
import { Mail, ShieldCheck, Tag, Users, X } from "lucide-react";
import Parse from "@/lib/parse-client";
import { track } from "@/lib/track";

const STAMP_KEY = "leaf_deals_offer_shown";
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const MEDIA_SRC = "/photo-row/bar-night.jpg";

export type DealsOfferSource = "me" | "calendar";

export interface DealsOffer {
  calendarId: string;
  calendarName: string;
  /** "Free outings around <placeName>": the neighborhood when the calendar has one. */
  placeName: string;
  includesMerchantHosted: boolean;
  /** The outing on the photo: the next merchant-hosted night, else the admin's sample. */
  sample: {
    title: string;
    detail: string;
    date: string | null;
    planId: string | null;
    kind: "merchant" | "sample";
  } | null;
}

/** True when the popup hasn't been shown in the last 30 days. */
export function dealsOfferDue(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STAMP_KEY);
    return !raw || Date.now() - Number(raw) > MONTH_MS;
  } catch {
    return false;
  }
}

/** Stamp it the moment it shows: closing without answering still counts. */
export function stampDealsOffer() {
  try { localStorage.setItem(STAMP_KEY, String(Date.now())); } catch { /* ignore */ }
}

function sampleWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function DealsOfferPopup({
  offer,
  source,
  onClose,
  onNeedSignIn,
}: {
  offer: DealsOffer;
  source: DealsOfferSource;
  onClose: () => void;
  /** Join was tapped with nobody signed in: the page takes them through
   *  sign-in and reopens this. Without it, the popup just says to sign in. */
  onNeedSignIn?: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track("deals_offer_shown", { src: source }, offer.calendarId);
    // Once per open; neither changes while it's up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function join() {
    if (state !== "idle") return;
    if (!Parse.User.current()) {
      if (onNeedSignIn) onNeedSignIn();
      else setError("Sign in first, then tap Join again.");
      return;
    }
    setState("sending");
    setError(null);
    track("deals_offer_cta", { src: source }, offer.calendarId);
    try {
      // Stripe's hosted checkout: $99 a year. They come back to this page
      // with ?club=joined (ClubNeighborReturn below says welcome).
      const r = (await Parse.Cloud.run("createClubNeighborCheckout", {
        calendarId: offer.calendarId,
        source,
        returnUrl: window.location.href,
      })) as { url?: string; already?: boolean };
      if (r.already || !r.url) {
        setState("done");
        return;
      }
      window.location.assign(r.url);
    } catch (e) {
      setState("idle");
      setError(e instanceof Error && e.message ? e.message : "That didn't go through. Try again.");
    }
  }

  const sample = offer.sample;
  const sampleLine = sample ? [sampleWhen(sample.date), sample.detail].filter(Boolean).join(" · ") : "";

  return (
    <div className="fm fixed inset-0 z-[60] flex items-end justify-center bg-fm-canvas/80 sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deals-offer-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-fm-canvas font-fm-sans text-fm-ink shadow-[0_40px_120px_rgba(0,0,0,0.5)] outline-none sm:max-w-[560px] sm:rounded-[32px] lg:min-h-[620px] lg:max-w-[920px] lg:flex-row"
      >
        {/* Media */}
        <div className="relative h-[190px] shrink-0 bg-fm-surface lg:h-auto lg:w-[380px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MEDIA_SRC} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-fm-canvas/10 via-transparent to-fm-canvas/90 lg:from-transparent lg:via-transparent lg:via-45% lg:to-fm-canvas/90" />
          <span aria-hidden className="absolute left-1/2 top-2.5 h-1 w-10 -translate-x-1/2 rounded-full bg-fm-ink/70 lg:hidden" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-2.5 top-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-fm-canvas/60 text-fm-ink lg:hidden"
          >
            <X size={18} aria-hidden />
          </button>
          {/* The outing, as it lands in their inbox */}
          {sample && (
            <div className="absolute inset-x-5 bottom-4 flex flex-col gap-2 lg:inset-x-6 lg:bottom-6">
              <span className="font-fm-mono text-[11px] uppercase tracking-[0.08em] text-fm-ink-2">Leaf · in your inbox</span>
              <div className="flex max-w-[300px] flex-col gap-1.5 self-start rounded-[18px] rounded-bl-md bg-fm-ink px-3.5 py-3 text-fm-canvas">
                <div className="text-[15px] font-semibold leading-tight">{sample.title}</div>
                <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-fm-line">
                  {sampleLine && <span>{sampleLine}</span>}
                  <span className="whitespace-nowrap rounded-full bg-fm-canvas px-2.5 py-0.5 text-xs font-bold text-fm-accent">
                    {sample.kind === "merchant" ? "Only on Leaf" : "Free for members"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Copy */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6 pt-5 lg:gap-6 lg:px-11 lg:pb-9 lg:pt-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-fm-line bg-fm-surface">
                <Tag size={18} className="text-fm-accent" aria-hidden />
              </span>
              <span className="font-fm-mono text-[11px] uppercase tracking-[0.08em] text-fm-muted">Club Neighbor</span>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2.5 -mt-2 hidden h-11 w-11 items-center justify-center rounded-full text-fm-muted hover:text-fm-ink lg:flex">
              <X size={20} aria-hidden />
            </button>
          </div>

          {state === "done" ? (
            <div className="flex flex-1 flex-col gap-3.5">
              <h2 id="deals-offer-title" className="m-0 font-fm-serif text-[32px] font-normal leading-[1.04] lg:text-[40px] lg:leading-[1.05]">
                You&rsquo;re already in.
              </h2>
              <p className="m-0 text-[15px] leading-normal text-fm-ink-2 lg:text-base">
                You&rsquo;re a Club Neighbor member, so there&rsquo;s nothing to pay. Your free outings are on their way to your inbox.
              </p>
              <div className="mt-auto">
                <button type="button" onClick={onClose} className="h-[52px] w-full rounded-full bg-fm-ink px-6 text-base font-semibold text-fm-canvas hover:bg-white">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2.5 lg:gap-3.5">
                <h2 id="deals-offer-title" className="m-0 font-fm-serif text-[32px] font-normal leading-[1.04] lg:text-[40px] lg:leading-[1.05]">
                  Free outings around <span className="text-fm-accent">{offer.placeName}</span>,{" "}
                  <span className="italic text-fm-ink-2">in your inbox every week.</span>
                </h2>
                <p className="m-0 text-[15px] leading-normal text-fm-ink-2 lg:text-base">
                  At least one free outing a week for a small group near you, like bowling or a movie, and prix fixe dinners too. Leaf emails it over.
                </p>
              </div>

              <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:gap-3">
                {([
                  [Mail, "At least one free outing in your inbox every week"],
                  [Users, "Small groups of neighbors, not crowds"],
                  [ShieldCheck, "30-day money-back guarantee"],
                ] as const).map(([Icon, text]) => (
                  <li key={text} className="flex items-center gap-3 text-sm lg:text-[15px]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-fm-line-dim bg-fm-surface">
                      <Icon size={16} className="text-fm-accent" aria-hidden />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex flex-col gap-4">
                <div className="flex items-baseline justify-between gap-3 border-t border-fm-line-dim pt-4">
                  <div className="flex shrink-0 items-baseline gap-2">
                    <span className="font-fm-serif text-[44px] leading-none">$8.25</span>
                    <span className="whitespace-nowrap text-[15px] text-fm-ink-2">a month</span>
                  </div>
                  <div className="text-right text-[13.5px] text-fm-ink-2">At least 52 free outings a year</div>
                </div>
                <button
                  type="button"
                  onClick={join}
                  disabled={state === "sending"}
                  className="h-[52px] w-full rounded-full bg-fm-accent px-6 text-base font-semibold text-fm-canvas hover:brightness-105 disabled:opacity-70"
                >
                  {state === "sending" ? "Taking you to checkout…" : "Join Club Neighbor"}
                </button>
                {error && <p role="alert" className="m-0 -mt-2 text-sm text-fm-danger">{error}</p>}
                <div className="-mt-2.5 flex items-center justify-between gap-3">
                  <p className="m-0 text-xs text-fm-muted">Billed yearly at $99. Cancel any time.</p>
                  <button type="button" onClick={onClose} className="h-11 shrink-0 px-1 text-sm font-medium text-fm-muted hover:text-fm-ink">
                    Not now
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Back from Stripe: `?club=joined` says welcome, once, and either value is
 * taken out of the address so a refresh or a shared link doesn't repeat it.
 * Membership is set by Stripe's webhook, which can land a few seconds after
 * they do, so the words don't claim more than "you're in".
 */
export function ClubNeighborReturn() {
  const [joined, setJoined] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("club") === "joined",
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    const club = url.searchParams.get("club");
    if (!club) return;
    url.searchParams.delete("club");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    if (club === "joined") track("deals_offer_joined", {});
  }, []);
  if (!joined) return null;
  return (
    <div className="fm fixed inset-0 z-[60] flex items-end justify-center bg-fm-canvas/80 sm:items-center sm:p-6" onClick={() => setJoined(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-neighbor-welcome"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col gap-5 rounded-t-[28px] bg-fm-canvas px-6 pb-7 pt-7 font-fm-sans text-fm-ink shadow-[0_40px_120px_rgba(0,0,0,0.5)] sm:max-w-[460px] sm:rounded-[32px] sm:px-9 sm:pb-9 sm:pt-9"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-fm-line bg-fm-surface">
            <Tag size={18} className="text-fm-accent" aria-hidden />
          </span>
          <span className="font-fm-mono text-[11px] uppercase tracking-[0.08em] text-fm-muted">Club Neighbor</span>
        </div>
        <h2 id="club-neighbor-welcome" className="m-0 font-fm-serif text-[34px] font-normal leading-[1.04]">
          You&rsquo;re in. <span className="italic text-fm-ink-2">Welcome to the club.</span>
        </h2>
        <p className="m-0 text-[15px] leading-normal text-fm-ink-2">
          Your first free outing will land in your inbox this week. Stripe has emailed your receipt, and you can cancel any time from your Me page.
        </p>
        <button type="button" onClick={() => setJoined(false)} className="h-[52px] w-full rounded-full bg-fm-accent px-6 text-base font-semibold text-fm-canvas hover:brightness-105">
          Sounds good
        </button>
      </div>
    </div>
  );
}

/**
 * /me, for a member: that they're in, and where to manage or cancel a paid
 * membership (Stripe's billing portal). A member an admin added has nothing
 * to manage.
 */
export function ClubNeighborMemberLine({ paid, cancelAtPeriodEnd }: { paid: boolean; cancelAtPeriodEnd: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function manage() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run("createClubNeighborPortal", { returnUrl: window.location.href })) as { url: string };
      window.location.assign(r.url);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error && e.message ? e.message : "That didn't open. Try again.");
    }
  }
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-zinc-600">
      <Tag size={14} aria-hidden className="text-[#253a33]" />
      <span>
        <span className="font-semibold text-zinc-900">Club Neighbor member.</span>{" "}
        {cancelAtPeriodEnd ? "Your membership ends when this year is up." : paid ? "$99 a year." : ""}
      </span>
      {paid && (
        <button type="button" onClick={manage} disabled={busy} className="min-h-11 underline underline-offset-2 hover:text-zinc-900 disabled:opacity-60 sm:min-h-0">
          {busy ? "Opening…" : "Manage or cancel"}
        </button>
      )}
      {error && <span role="alert" className="basis-full text-red-700">{error}</span>}
    </p>
  );
}
