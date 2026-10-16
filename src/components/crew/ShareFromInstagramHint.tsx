"use client";

/**
 * "Saw a spot on Instagram?": the crew book's hint for the share sheet. A
 * small phone loops through the four steps (send the post, pick Leaf, Add on
 * the crew, it's in the book) beside the same steps in words. Pure CSS: one
 * 10s loop, each scene in its own quarter. With reduced motion it holds still
 * on the "Add" step. Each member can close it; it stays closed for them on
 * every device (hideCrewTip), and at once on this one.
 */

import { useState, useSyncExternalStore } from "react";
import { Bookmark, Check, Heart, MessageCircle, Send, X } from "lucide-react";
import { run, type CrewAuth } from "@/lib/crew";

const KEY = "fm-ig-share-hint-hidden";
const APP_STORE_URL = "https://apps.apple.com/us/app/leaf-build-your-community/id1040588046";
const LOOP = 10; // seconds
const SCENE = LOOP / 4;

// Each scene, step caption and its animated parts share one clock: delay
// `i * SCENE - LOOP` starts scene i in its own quarter of the loop.
const at = (i: number) => ({ animationDelay: `${i * SCENE - LOOP}s` });

const CSS = `
.igh-scene, .igh-step, .igh-dot, .igh-tap, .igh-sheet, .igh-added, .igh-add, .igh-row { animation-duration: ${LOOP}s; animation-iteration-count: infinite; animation-timing-function: ease-out; }
.igh-scene { opacity: 0; animation-name: igh-scene; }
@keyframes igh-scene { 0% { opacity: 0 } 2% { opacity: 1 } 23% { opacity: 1 } 25%, 100% { opacity: 0 } }
.igh-step { animation-name: igh-step; }
@keyframes igh-step { 0% { color: var(--color-fm-muted) } 2%, 23% { color: var(--color-fm-ink) } 25%, 100% { color: var(--color-fm-muted) } }
.igh-dot { animation-name: igh-dot; }
@keyframes igh-dot { 0% { background: var(--color-fm-line) } 2%, 23% { background: var(--color-fm-accent) } 25%, 100% { background: var(--color-fm-line) } }
.igh-tap { opacity: 0; animation-name: igh-tap; }
@keyframes igh-tap { 0%, 11% { opacity: 0; transform: scale(.4) } 14% { opacity: .9; transform: scale(1) } 19% { opacity: 0; transform: scale(1.6) } 100% { opacity: 0 } }
.igh-sheet { animation-name: igh-sheet; }
@keyframes igh-sheet { 0% { transform: translateY(100%) } 7%, 100% { transform: translateY(0) } }
.igh-add { animation-name: igh-add; }
@keyframes igh-add { 0%, 15% { opacity: 1 } 16%, 100% { opacity: 0 } }
.igh-added { opacity: 0; animation-name: igh-added; }
@keyframes igh-added { 0%, 15% { opacity: 0 } 16%, 100% { opacity: 1 } }
.igh-row { animation-name: igh-row; }
@keyframes igh-row { 0%, 4% { opacity: 0; transform: translateY(-8px) } 10%, 100% { opacity: 1; transform: none } }
@media (prefers-reduced-motion: reduce) {
  .igh-scene, .igh-step, .igh-dot, .igh-tap, .igh-sheet, .igh-added, .igh-add, .igh-row { animation: none; }
  .igh-scene { opacity: 0 } .igh-scene.igh-still { opacity: 1 }
  .igh-added { opacity: 1 } .igh-add { opacity: 0 }
}
`;

function Tap({ i, className }: { i: number; className: string }) {
  return <span aria-hidden style={at(i)} className={`igh-tap absolute h-7 w-7 rounded-full border-2 border-white bg-white/40 ${className}`} />;
}

function Phone({ crewName }: { crewName: string }) {
  return (
    <div aria-hidden className="relative h-[236px] w-[128px] shrink-0 overflow-hidden rounded-[22px] border-[3px] border-fm-line bg-[#0b0f0d] text-[9px] text-white">
      {/* 1. A post: tap send */}
      <div style={at(0)} className="igh-scene absolute inset-0 flex flex-col">
        <div className="flex items-center gap-1.5 px-2 py-2">
          <span className="h-4 w-4 rounded-full bg-gradient-to-br from-amber-300 to-pink-500" />
          <span className="font-semibold">a coffee spot</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/friend-mode/crews/coffee.jpg" alt="" className="aspect-square w-full object-cover" />
        <div className="relative flex items-center gap-2.5 px-2 py-2">
          <Heart size={13} /> <MessageCircle size={13} /> <Send size={13} />
          <Bookmark size={13} className="ml-auto" />
          <Tap i={0} className="left-[44px] top-[0px]" />
        </div>
        <div className="px-2 text-white/60">Best cortado in Brooklyn ☕️</div>
      </div>

      {/* 2. The share row: tap Leaf */}
      <div style={at(1)} className="igh-scene absolute inset-0 bg-black/60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/friend-mode/crews/coffee.jpg" alt="" className="aspect-square w-full object-cover opacity-40" />
        <div style={at(1)} className="igh-sheet absolute inset-x-0 bottom-0 rounded-t-[14px] bg-[#1f1f1f] px-2 pb-4 pt-2">
          <div className="mx-auto mb-2 h-[3px] w-6 rounded-full bg-white/30" />
          <div className="mb-2 text-center font-semibold">Share to</div>
          <div className="relative flex justify-between">
            {["#3d3d3d", "#3d3d3d", "leaf", "#3d3d3d"].map((c, k) => (
              <span key={k} className="flex flex-col items-center gap-1">
                {c === "leaf" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/leaf-mark.png" alt="" className="h-6 w-6 rounded-[7px] bg-white object-contain p-0.5" />
                ) : (
                  <span className="h-6 w-6 rounded-[7px]" style={{ background: c }} />
                )}
                <span className={`text-[7px] ${c === "leaf" ? "text-white" : "text-white/40"}`}>{c === "leaf" ? "Leaf" : "App"}</span>
              </span>
            ))}
            <Tap i={1} className="left-[56px] top-[-2px]" />
          </div>
        </div>
      </div>

      {/* 3. Share to Leaf: Add on the crew */}
      <div style={at(2)} className="igh-scene igh-still absolute inset-0 flex flex-col justify-end bg-black/70">
        <div className="rounded-t-[14px] bg-fm-canvas px-2.5 pb-5 pt-3">
          <div className="text-[11px] font-semibold">Share to Leaf</div>
          <div className="mb-2.5 text-[8px] text-fm-muted">Add it to a crew&rsquo;s book</div>
          <div className="relative flex items-center gap-1.5 rounded-[10px] bg-fm-card p-1.5">
            <span className="min-w-0 flex-1 leading-tight">
              <span className="line-clamp-2 font-semibold">{crewName}</span>
              <span className="text-[7px] text-fm-muted">Into the crew&rsquo;s book</span>
            </span>
            <span className="relative inline-flex h-5 w-[38px] shrink-0 items-center justify-center">
              <span style={at(2)} className="igh-add absolute inset-0 flex items-center justify-center rounded-full bg-fm-ink text-[8px] font-bold text-fm-canvas">Add</span>
              <span style={at(2)} className="igh-added absolute inset-0 flex items-center justify-center gap-0.5 rounded-full bg-fm-accent text-[8px] font-bold text-fm-canvas"><Check size={8} strokeWidth={3} />Added</span>
            </span>
            <Tap i={2} className="right-[8px] top-[2px]" />
          </div>
        </div>
      </div>

      {/* 4. In the book */}
      <div style={at(3)} className="igh-scene absolute inset-0 bg-fm-canvas px-2.5 pt-4">
        <div className="mb-0.5 text-[8px] text-fm-muted">{crewName}</div>
        <div className="mb-2.5 font-fm-serif text-[18px] leading-none">The <i>book</i></div>
        <div style={at(3)} className="igh-row mb-1.5 flex items-center gap-1.5 rounded-[10px] border border-fm-accent p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/friend-mode/crews/coffee.jpg" alt="" className="h-7 w-7 rounded-[6px] object-cover" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">a coffee spot</span>
            <span className="text-[7px] text-fm-accent">Just added</span>
          </span>
        </div>
        {[0, 1].map((k) => (
          <div key={k} className="mb-1.5 flex items-center gap-1.5 rounded-[10px] bg-fm-surface p-1.5 opacity-60">
            <span className="h-7 w-7 rounded-[6px] bg-fm-card" />
            <span className="h-1.5 w-12 rounded-full bg-fm-line" />
          </div>
        ))}
      </div>
    </div>
  );
}

export const IG_SHARE_TIP = "igShare";

export default function ShareFromInstagramHint({ crewName, inApp, auth, hiddenTips = [] }: { crewName: string; inApp: boolean; auth: CrewAuth; hiddenTips?: string[] }) {
  // Closed by this member (any device), on this device before that was saved, or just now.
  const hiddenBefore = useSyncExternalStore(
    () => () => {},
    () => { try { return Boolean(localStorage.getItem(KEY)); } catch { return false; } },
    () => false,
  );
  const [hidden, setHidden] = useState(false);
  if (hidden || hiddenBefore || hiddenTips.includes(IG_SHARE_TIP)) return null;

  const hide = () => {
    setHidden(true);
    try { localStorage.setItem(KEY, "1"); } catch {}
    run("hideCrewTip", auth, { tip: IG_SHARE_TIP }).catch(() => {});
  };
  const steps = [
    <>On the post, tap <Send size={13} className="inline -translate-y-px" aria-label="Share" /></>,
    <>Pick <b className="font-semibold">Leaf</b> in the share row (tap <b className="font-semibold">More</b> if it&rsquo;s not there)</>,
    <>Tap <b className="font-semibold">Add</b> next to {crewName}</>,
    <>It&rsquo;s in the book</>,
  ];

  return (
    <section aria-label="Add places from Instagram" className="relative flex items-center gap-4 rounded-[24px] border border-fm-line-dim bg-fm-surface p-4 lg:gap-6 lg:p-5">
      <style>{CSS}</style>
      <Phone crewName={crewName} />
      <div className="min-w-0 flex-1">
        <h2 className="m-0 pr-8 font-fm-serif text-[22px] font-normal leading-tight lg:text-[26px]">Saw a spot on Instagram?</h2>
        <p className="mb-3 mt-1 text-[13px] leading-snug text-fm-ink-2">Share it straight to Leaf. Works from TikTok too.</p>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {steps.map((s, i) => (
            <li key={i} style={at(i)} className="igh-step flex items-start gap-2 text-[13px] leading-snug text-fm-ink-2">
              <span style={at(i)} className="igh-dot mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-fm-line" aria-hidden />
              <span>{s}</span>
            </li>
          ))}
        </ol>
        {!inApp && (
          <p className="mb-0 mt-3 text-xs text-fm-muted">
            Needs the Leaf app on your iPhone. <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-fm-ink-2 underline">Get it</a>
          </p>
        )}
      </div>
      <button type="button" onClick={hide} aria-label="Hide this tip" className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-fm-muted hover:bg-fm-card hover:text-fm-ink">
        <X size={16} aria-hidden />
      </button>
    </section>
  );
}
