"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

// ============================================================================
// Post-follow interest modal — "Which of these would you go to?" (handoff turn
// 9: 9a mobile full-screen stack, 9b desktop photo grid). Shown right after a
// follow lands on any calendar with suggestions on; runs BEFORE the share kit
// on neighborhood calendars and is the only post-follow surface elsewhere.
//
// Presentation only. The parent owns the list (already sorted and capped —
// the order must not move under the user's finger, so it is snapshotted once
// at open), the marked/pending sets, and the per-tap writes. Every tap is one
// independent optimistic write; Done and Skip differ only in what has already
// been written. Copy never mentions hosts, and no counts are shown.
// ============================================================================

export interface InterestPromptItem {
  /** Parent-scoped id, e.g. "idea:<objectId>" or "ai:<index>". */
  id: string;
  title: string;
  /** Pre-formatted, e.g. "Sun, Sep 21". Null when the plan has no date. */
  dateLabel: string | null;
  /** Venue name or neighborhood — never an address. */
  place: string | null;
  image: string | null;
}

export default function InterestPrompt({
  calendarName,
  items,
  marked,
  pending,
  onToggle,
  onDone,
  onSkip,
}: {
  calendarName: string;
  items: InterestPromptItem[];
  marked: ReadonlySet<string>;
  pending: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onDone: () => void;
  /** Skip, ✕, Esc and the scrim. Continues to the same next step as Done. */
  onSkip: () => void;
}) {
  // Cards toggled during THIS mount get the fill-and-pop; cards that arrive
  // already marked (seeded from existing interest records) render filled with
  // no animation.
  const [animated, setAnimated] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  // The mobile surface is full-screen; the page under it must not scroll.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const count = items.reduce((n, it) => (marked.has(it.id) ? n + 1 : n), 0);

  const tap = (id: string) => {
    if (pending.has(id)) return;
    setAnimated((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    onToggle(id);
  };

  return (
    <div className="ip-scrim" onClick={onSkip}>
      <InterestPromptStyles />
      <div
        className="ip"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ip-headline"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="ip-x" aria-label="Close" onClick={onSkip}>
          <X size={18} strokeWidth={2} />
        </button>

        <header className="ip-head">
          <p className="ip-eyebrow">
            <span className="ip-m">Ideas for the group</span>
            <span className="ip-d">{calendarName}</span>
          </p>
          <h2 id="ip-headline" className="ip-h">
            Which of these would you go to?
          </h2>
          <p className="ip-sub ip-d">One tap marks interest. Nothing is a commitment.</p>
        </header>

        <div className="ip-scroll">
          <div className="ip-grid">
            {items.map((item) => {
              const on = marked.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`ip-card${on ? " on" : ""}${animated.has(item.id) ? " anim" : ""}`}
                  aria-pressed={on}
                  aria-label={`${item.title}${item.dateLabel ? `, ${item.dateLabel}` : ""}${item.place ? `, ${item.place}` : ""}`}
                  onClick={() => tap(item.id)}
                >
                  {item.image && <CardImage src={item.image} />}
                  <span className="ip-shade" aria-hidden />
                  <span className="ip-heart" aria-hidden>
                    <HeartIcon />
                  </span>
                  <span className="ip-text" aria-hidden>
                    {(item.dateLabel || item.place) && (
                      <span className="ip-meta">
                        {[item.dateLabel, item.place].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    <span className="ip-title">{item.title}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="ip-note ip-m">Nothing is a commitment. We&rsquo;ll text you if it happens.</p>
        </div>

        <footer className="ip-foot">
          <p className="ip-status" aria-live="polite">
            {count === 0 ? (
              <>
                <span className="ip-m">Tap any you&rsquo;d go to</span>
                <span className="ip-d">Tap as many as you like.</span>
              </>
            ) : (
              <>
                <span className="ip-m">{count} marked</span>
                <span className="ip-d">{count} marked. We&rsquo;ll text you if it happens.</span>
              </>
            )}
          </p>
          <div className="ip-actions">
            <button type="button" className="ip-skip ip-d" onClick={onSkip}>
              Skip
            </button>
            <button type="button" className="ip-done" onClick={onDone}>
              Done
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// Card background color paints first; the photo fades in once it has loaded
// (spec: "Slow images"). A broken URL leaves the placeholder — never a stock
// substitute.
function CardImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={`ip-img${loaded ? " in" : ""}`}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
}

// Static heart. The Lottie fill-and-pop (heart-fill.json) swaps into this same
// box once the asset lands; until then the CSS transition + keyframe below is
// the shipped fallback, and reduced-motion cross-fades the fill.
function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ip-heart-svg" focusable="false">
      <path
        d="M12 21s-6.7-4.3-9.3-8.2C.6 9.6 1.6 5.6 5 4.3c2.2-.8 4.5 0 7 2.6 2.5-2.6 4.8-3.4 7-2.6 3.4 1.3 4.4 5.3 2.3 8.5C18.7 16.7 12 21 12 21z"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InterestPromptStyles() {
  return <style>{INTEREST_PROMPT_CSS}</style>;
}

const INTEREST_PROMPT_CSS = `
.ip-scrim{position:fixed;inset:0;z-index:50;display:flex;align-items:stretch;justify-content:center;
  background:rgba(40,30,10,.32)}
.ip{--ip-serif:var(--font-newsreader),Georgia,serif;
  position:relative;display:flex;flex-direction:column;width:100%;min-height:0;
  background:#18181b;color:#fff;overflow:hidden}
.ip *{box-sizing:border-box}
.ip button{font:inherit;cursor:pointer}
.ip-x{position:absolute;top:18px;right:16px;z-index:2;display:flex;padding:8px;border:0;background:none;
  color:rgba(255,255,255,.5)}
.ip-x:hover{color:#fff}
.ip-head{flex:none;padding:26px 24px 16px}
.ip-eyebrow{margin:0 0 10px;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:rgba(255,255,255,.45)}
.ip-h{margin:0;font-family:var(--ip-serif);font-weight:400;font-size:27px;line-height:1.12;
  max-width:270px;color:#fff;text-wrap:pretty}
.ip-sub{margin:8px 0 0;font-size:14.5px;line-height:1.4;color:#71717a}
.ip-d{display:none}
.ip-m{display:inline}

.ip-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 24px 0}
.ip-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
.ip-note{margin:14px 0 4px;font-size:12.5px;line-height:1.4;color:rgba(255,255,255,.45)}

.ip-card{position:relative;display:block;width:100%;height:176px;padding:0;border:0;border-radius:18px;
  overflow:hidden;background:#3f3f46;color:#fff;text-align:left;
  box-shadow:0 0 0 0 rgba(16,185,129,0);transition:box-shadow .15s ease;-webkit-tap-highlight-color:transparent}
.ip-card.on{box-shadow:0 0 0 2px #10b981}
.ip-card:focus-visible{outline:2px solid #fff;outline-offset:2px}
.ip-card>*{pointer-events:none}
.ip-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .35s ease}
.ip-img.in{opacity:1}
.ip-shade{position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(10,10,12,.05) 0%,rgba(10,10,12,.32) 45%,rgba(10,10,12,.81) 100%)}
.ip-heart{position:absolute;left:50%;top:56px;width:64px;height:64px;margin:-32px 0 0 -32px;
  filter:drop-shadow(0 1px 3px rgba(0,0,0,.45))}
.ip-heart-svg{display:block;width:100%;height:100%;overflow:visible;
  fill:rgba(255,255,255,.12);transition:fill .2s ease}
.ip-card.on .ip-heart-svg{fill:#fff}
.ip-card.on.anim .ip-heart{animation:ip-pop .5s cubic-bezier(.2,.8,.3,1.2) 1 both}
.ip-card.anim:not(.on) .ip-heart{animation:ip-unpop .22s ease-out 1 both}
@keyframes ip-pop{0%{transform:scale(1)}38%{transform:scale(1.3)}66%{transform:scale(.92)}100%{transform:scale(1)}}
@keyframes ip-unpop{0%{transform:scale(1)}50%{transform:scale(.86)}100%{transform:scale(1)}}
.ip-text{position:absolute;left:16px;right:16px;bottom:14px;display:block}
.ip-meta{display:block;margin-bottom:5px;font-size:10px;font-weight:700;letter-spacing:.09em;
  text-transform:uppercase;color:rgba(255,255,255,.8)}
.ip-title{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;
  font-family:var(--ip-serif);font-weight:400;font-size:21px;line-height:1.18;color:#fff;text-wrap:pretty}

.ip-foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:16px;
  padding:16px 24px calc(26px + env(safe-area-inset-bottom))}
.ip-status{margin:0;font-size:13.5px;line-height:1.35;color:rgba(255,255,255,.5)}
.ip-actions{display:flex;align-items:center;gap:22px;flex:none}
.ip-skip{border:0;background:none;padding:6px 0;font-size:11.5px;font-weight:700;letter-spacing:.14em;
  text-transform:uppercase;color:#a1a1aa}
.ip-skip:hover{color:#71717a}
.ip-done{height:48px;padding:0 30px;border:0;border-radius:14px;background:#fff;color:#18181b;
  font-size:15px;font-weight:600}
.ip-done:hover{opacity:.92}

@media(min-width:640px){
  .ip-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(min-width:768px){
  .ip-scrim{align-items:center;padding:32px 24px}
  .ip{width:100%;max-width:960px;max-height:min(640px,calc(100vh - 64px));border-radius:12px;
    background:#fbfaf7;color:#18181b;box-shadow:0 20px 60px rgba(0,0,0,.22)}
  .ip-x{top:18px;right:18px;color:#a1a1aa}
  .ip-x:hover{color:#18181b}
  .ip-head{padding:40px 48px 0;max-width:620px}
  .ip-eyebrow{color:#a1a1aa}
  .ip-h{font-size:33px;line-height:1.15;max-width:none;color:#18181b}
  .ip-d{display:inline}
  .ip-m{display:none}
  .ip-sub.ip-d{display:block}
  .ip-scroll{padding:26px 48px 8px}
  .ip-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
  .ip-card{height:196px;border-radius:16px;background:#e4e4e7}
  .ip-heart{top:62px;width:58px;height:58px;margin:-29px 0 0 -29px}
  .ip-text{left:14px;right:14px;bottom:13px}
  .ip-meta{font-size:9.5px}
  .ip-title{font-size:19px;line-height:1.2}
  .ip-foot{padding:16px 48px 24px;border-top:1px solid rgba(0,0,0,.07)}
  .ip-status{color:#71717a}
  .ip-skip.ip-d{display:inline-block}
  .ip-done{height:44px;padding:0 26px;border-radius:10px;background:#18181b;color:#fff;font-size:14px}
}
@media(min-width:768px) and (max-width:899px){
  .ip-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(prefers-reduced-motion:reduce){
  .ip-card .ip-heart{animation:none!important}
  .ip-card{transition:none}
  .ip-img{transition:none}
}
`;
