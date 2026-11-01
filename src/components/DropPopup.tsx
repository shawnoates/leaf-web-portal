"use client";

/**
 * "It's live": /me's only Drop surface, a popup at most once a week (across
 * all Drops) while one on a calendar they follow is open or full. Open: Get your pass. Full: Join the
 * waitlist by saving a card; nothing is charged unless a spot opens for them,
 * in the order people joined. The Drop's video loops silently behind the top (photo if none); there
 * is deliberately no sound control.
 *
 * Skipped when they hold a pass or are already waitlisted, and on a visit
 * where the first-points celebration is due (that goes first; this waits for
 * the next visit). Two live at once: the one that opened most recently.
 * When it last showed is kept in this browser.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";
import Parse from "@/lib/parse-client";
import { dropGets, dropWhen, dropWhere, money, type Drop } from "@/lib/drops";
import type { PointsUnseen } from "@/lib/points";

const LAST_SHOWN = "leaf_drop_popup_last";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function shownThisWeek(): boolean {
  try {
    const last = Number(localStorage.getItem(LAST_SHOWN));
    return Number.isFinite(last) && Date.now() - last < WEEK_MS;
  } catch {
    return true; // no storage: never risk showing it on every visit
  }
}

function markShown() {
  try {
    localStorage.setItem(LAST_SHOWN, String(Date.now()));
  } catch {}
}

/** The Drop to pop, or null. */
export function pickPopupDrop(drops: Drop[]): Drop | null {
  return (
    drops
      .filter((d) => !d.pass && (d.status === "open" || (d.status === "sold_out" && !d.waitlisted)))
      .sort((a, b) => new Date(b.opensAt || 0).getTime() - new Date(a.opensAt || 0).getTime())[0] || null
  );
}

export default function DropPopup({ drops }: { drops: Drop[] }) {
  const [drop, setDrop] = useState<Drop | null>(null);

  useEffect(() => {
    if (shownThisWeek()) return;
    const pick = pickPopupDrop(drops);
    if (!pick) return;
    let cancelled = false;
    // The first-points celebration owns this visit if it's due.
    Parse.Cloud.run("getPointsSummary")
      .then((s: { unseen?: PointsUnseen[] }) => s?.unseen?.some((u) => u.first) === true)
      .catch(() => false)
      .then((celebrating: boolean) => {
        if (cancelled || celebrating) return;
        markShown();
        setDrop(pick);
      });
    return () => {
      cancelled = true;
    };
  }, [drops]);

  if (!drop) return null;
  return <Popup drop={drop} onClose={() => setDrop(null)} />;
}

type Setup = { clientSecret: string; publishableKey: string | null };

/** A full Drop's popup also opens from its card's Join the waitlist. */
export function Popup({ drop, onClose }: { drop: Drop; onClose: () => void }) {
  const full = drop.status === "sold_out";
  const [joined, setJoined] = useState(drop.waitlisted);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const primary = useRef<HTMLElement | null>(null);
  const [motionOk, setMotionOk] = useState(false);
  const [more, setMore] = useState(false);
  const about = (drop.description || drop.teaser || "").trim();

  useEffect(() => {
    setMotionOk(!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    primary.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Step 1: a SetupIntent to save their card. Nothing is charged.
  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run("startDropWaitlist", { planId: drop.id })) as { state: string } & Partial<Setup>;
      if (r.state === "waitlisted") setJoined(true);
      else if (r.clientSecret) setSetup({ clientSecret: r.clientSecret, publishableKey: r.publishableKey || null });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't start that. Try again.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!setup || !cardRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        if (!setup.publishableKey) throw new Error("Payments are not configured.");
        const stripe = stripeRef.current || (await loadStripe(setup.publishableKey));
        if (cancelled || !stripe) return;
        stripeRef.current = stripe;
        const elements = stripe.elements({
          clientSecret: setup.clientSecret,
          appearance: { theme: "stripe", variables: { borderRadius: "10px", colorPrimary: "#131714", fontFamily: "inherit", fontSizeBase: "15px" } },
        });
        elementsRef.current = elements;
        elements
          .create("payment", { layout: "tabs", fields: { billingDetails: { address: { country: "never", postalCode: "auto" } } } })
          .mount(cardRef.current!);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load card entry.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setup]);

  // Step 2: save the card, then they're in line.
  const saveCard = async () => {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error: err } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: window.location.href,
        payment_method_data: { billing_details: { address: { country: "US" } } },
      },
      redirect: "if_required",
    });
    if (err) {
      setError(err.message || "That card didn't go through.");
      setBusy(false);
      return;
    }
    try {
      await Parse.Cloud.run("confirmDropWaitlist", { planId: drop.id });
      setJoined(true);
      setSetup(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't add you. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const charge = money(drop.feeCents);

  const worth = drop.valueCents > drop.feeCents ? money(drop.valueCents) : null;
  const what = drop.includes || dropGets(drop);
  const showVideo = Boolean(drop.videoUrl) && motionOk;
  const hasMedia = showVideo || Boolean(drop.imageUrl);

  // Over the video on phones; beside it on desktop, so a host talking to
  // camera isn't covered. Only one copy shows (the other is display:none).
  const head = (
    <>
      {/* Kept short: the calendar is on the /me card, and the spots sit by the button. */}
      <span className="dp-eyebrow">◆ The Drop</span>
      <h2 className="dp-title">{drop.title}</h2>
      <p className="dp-when">{[dropWhen(drop.startsAt), dropWhere(drop)].filter(Boolean).join(" · ")}</p>
    </>
  );

  return (
    <div className="dp-scrim" onClick={onClose}>
      <style>{STYLES}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={full ? `${drop.title} is full` : `${drop.title} is live`}
        className={`dp-card${hasMedia ? " dp-split" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="dp-x" aria-label="Close" onClick={onClose}>×</button>
        <div className={`dp-hero${hasMedia ? " dp-hero-media" : ""}`}>
          {showVideo ? (
            <video
              className="dp-media"
              src={drop.videoUrl!}
              poster={drop.imageUrl || undefined}
              autoPlay
              loop
              muted
              playsInline
              aria-hidden="true"
              // Phones only autoplay muted video, and React doesn't always
              // write the muted attribute: set it on the element too.
              ref={(el) => {
                if (el) el.muted = true;
              }}
            />
          ) : drop.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="dp-media" src={drop.imageUrl} alt="" />
          ) : null}
          {hasMedia && <div className="dp-shade" aria-hidden="true" />}
          <div className="dp-head dp-head-over">{head}</div>
        </div>

        <div className="dp-body">
          <div className="dp-head dp-head-side">{head}</div>
          {about && (
            <div className="dp-about">
              <p className={more ? "" : "dp-clamp"}>{about}</p>
              {!more && about.length > 140 && (
                <button type="button" className="dp-more" onClick={() => setMore(true)}>More</button>
              )}
            </div>
          )}
          {/* What it's worth and what it costs, side by side: the value struck through. */}
          <div className="dp-deal">
            <div className="dp-deal-what">
              <span className="dp-label">You get</span>
              {what && <p>{what}</p>}
            </div>
            <p className="dp-deal-price">
              {worth && <s aria-label={`worth ${worth}`}>{worth}</s>}
              <strong>{money(drop.feeCents)}</strong>
            </p>
          </div>

          {full ? (
            joined ? (
              <div className="dp-note" aria-live="polite">
                <strong><Check className="dp-check" aria-hidden="true" /> You&apos;re on the waitlist</strong>
                <span>If a spot opens, we&apos;ll charge your card {charge} and text you your pass. Nothing&apos;s charged otherwise.</span>
              </div>
            ) : (
              <div className="dp-note">
                <strong>Save a card to get in line</strong>
                <span>We only charge {charge} if a spot opens for you, then text you your pass. Spots go in the order people join.</span>
              </div>
            )
          ) : null}
          {drop.capacity && drop.spotsLeft !== null && <Seats capacity={drop.capacity} left={drop.spotsLeft} />}

          {full && setup && !joined && <div ref={cardRef} className="dp-cardform" />}
          {full ? (
            joined ? (
              <button type="button" className="dp-cta" onClick={onClose} ref={(el) => { primary.current = el; }}>Done</button>
            ) : setup ? (
              <button type="button" className="dp-cta" onClick={saveCard} disabled={busy}>
                {busy && <Loader2 className="dp-spin" aria-hidden="true" />} Save card · join the waitlist
              </button>
            ) : (
              <button type="button" className="dp-cta" onClick={join} disabled={busy} ref={(el) => { primary.current = el; }}>
                {busy && <Loader2 className="dp-spin" aria-hidden="true" />} Join the waitlist
              </button>
            )
          ) : (
            <Link href={`/p/${drop.id}`} className="dp-cta" ref={(el) => { primary.current = el; }}>
              Get your pass · {money(drop.feeCents)}
            </Link>
          )}
          {error && <p className="dp-error">{error}</p>}
          {!joined && <button type="button" className="dp-later" onClick={onClose}>Maybe later</button>}
          <p className="dp-fine">
            {full
              ? "The waitlist closes 3 hours before it starts"
              : "First come, first served · Full refund if you cancel 48+ hours before"}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Spots left as seats, right over the button: open ones lit, taken ones dim (a bar past 24). */
function Seats({ capacity, left }: { capacity: number; left: number }) {
  const label = left > 0 ? `${left} of ${capacity} spots left` : `All ${capacity} spots claimed`;
  return (
    <div className="dp-seats" role="img" aria-label={label}>
      {capacity <= 24 ? (
        <span className="dp-seat-row" aria-hidden="true">
          {Array.from({ length: capacity }, (_, i) => (
            <span key={i} className={i < capacity - left ? "dp-seat" : "dp-seat dp-seat-open"} />
          ))}
        </span>
      ) : (
        <span className="dp-seat-bar" aria-hidden="true">
          <span style={{ width: `${(left / capacity) * 100}%` }} />
        </span>
      )}
      <span aria-hidden="true">{label}</span>
    </div>
  );
}

// Plain CSS like PointsEarned: /me's resets (`.leafme p { margin: 0 }`) and
// Tailwind margins don't fight it.
const STYLES = `
.dp-scrim{position:fixed;inset:0;z-index:1000;background:rgba(23,21,15,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:var(--font-geist-sans,-apple-system,BlinkMacSystemFont,sans-serif)}
.dp-card{position:relative;width:min(358px,100%);max-height:calc(100vh - 32px);overflow-y:auto;background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.3);color:#17150f}
.dp-hero{position:relative;overflow:hidden;background:#131714;color:#fff;padding:56px 24px 22px;display:flex;flex-direction:column;justify-content:flex-end;gap:6px}
.dp-hero-media{min-height:260px;box-sizing:border-box}
.dp-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.dp-shade{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(19,23,20,.15) 0%,rgba(19,23,20,.6) 45%,rgba(19,23,20,.94) 100%)}
.dp-hero>*:not(.dp-media):not(.dp-shade){position:relative}
.dp-x{position:absolute;top:8px;right:8px;width:44px;height:44px;border-radius:22px;border:none;background:rgba(19,23,20,.55);color:#fff;font-size:22px;line-height:1;cursor:pointer;z-index:3}
.dp-head{display:flex;flex-direction:column;gap:6px}
.dp-head-side{display:none}
.dp-eyebrow{font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:#C9F27B}
.dp-title{margin:2px 0 0;font-size:26px;line-height:1.2;font-weight:600;color:#fff}
.dp-when{margin:0;font-size:13px;color:rgba(255,255,255,.8)}
.dp-body{padding:20px 24px 18px;display:flex;flex-direction:column;gap:14px}
.dp-about{display:flex;flex-direction:column;gap:4px}
.dp-about p{margin:0;font-size:14px;line-height:1.55;color:#3d3a33;white-space:pre-line}
.dp-clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.dp-more{align-self:flex-start;background:none;border:none;padding:4px 0;font-size:13px;font-weight:500;color:#253a33;text-decoration:underline;text-underline-offset:2px;cursor:pointer;font-family:inherit}
.dp-label{font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;color:#6f6a5f}
.dp-deal{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 14px;border-radius:10px;background:#f3f7f5}
.dp-deal-what{display:flex;flex-direction:column;gap:3px;min-width:0}
.dp-deal-what p{margin:0;font-size:14px;line-height:1.4;color:#131714}
.dp-deal-price{margin:0;flex:none;display:flex;align-items:baseline;gap:8px}
.dp-deal-price s{font-size:14px;color:#8b8578}
.dp-deal-price strong{font-size:22px;font-weight:600;color:#131714}
.dp-seats{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:500;color:#3f6212}
.dp-seat-row{display:flex;gap:3px}
.dp-seat{width:6px;height:12px;border-radius:1px;background:#e4e4e7}
.dp-seat-open{background:#65a30d}
.dp-seat-bar{width:96px;height:4px;border-radius:2px;background:#e4e4e7;overflow:hidden}
.dp-seat-bar span{display:block;height:100%;background:#65a30d}
.dp-note{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:10px;background:#f3f7f5;font-size:12px;line-height:1.5;color:#253a33}
.dp-note strong{font-size:13px;display:inline-flex;align-items:center;gap:6px}
.dp-check{width:14px;height:14px}
.dp-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:15px 14px;border:none;border-radius:10px;background:#131714;color:#fff;font-size:15px;font-weight:600;text-decoration:none;cursor:pointer;font-family:inherit;box-sizing:border-box}
.dp-cta:disabled{opacity:.6}
/* /me sets every link to color:inherit; the Get your pass link needs its white. */
.dp-card a.dp-cta{color:#fff}
.dp-spin{width:16px;height:16px;animation:spin 1s linear infinite}
.dp-cardform{min-height:120px}
.dp-later{background:none;border:none;padding:10px 0;font-size:13px;color:#6f6a5f;cursor:pointer;font-family:inherit}
.dp-fine{margin:0;text-align:center;font-size:11px;color:#8b8578}
.dp-error{margin:0;font-size:12px;color:#b91c1c;text-align:center}
/* Wide screens with a video or photo: two columns, the media alone at full
   height on the left and everything else on the right. */
@media (min-width:768px){
.dp-split{width:min(720px,100%);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.dp-split .dp-hero{min-height:520px;padding:0}
.dp-split .dp-head-over,.dp-split .dp-shade{display:none}
.dp-split .dp-head-side{display:flex;padding-right:40px}
.dp-head-side .dp-eyebrow{color:#3f6212}
.dp-head-side .dp-title{color:#131714}
.dp-head-side .dp-when{color:#6f6a5f}
.dp-split .dp-body{padding:28px 28px 22px;justify-content:center}
}
`;
