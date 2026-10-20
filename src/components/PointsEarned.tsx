"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Parse from "@/lib/parse-client";
import { awardLine, type PointsUnseen } from "@/lib/points";
import { POINTS_EVENT } from "@/components/PointsChip";

// "You earned points", shown on the first Leaf page someone opens after an
// award. The very first award opens the celebration (dark green hero, a
// counting-up number, confetti); later ones are a quiet banner. The server
// stamps seenAt on dismiss, so it shows once per award across devices.
// Mounted once in the root layout; signed-out visitors never see it.

const LADDER = [10, 20, 30, 40, 50];
const CONFETTI = ["#c8f25a", "#f2f1ec", "#6dbf7a", "#a7dcb0", "#c8f25a"];

// A fixed scatter (no Math.random in render): the same burst every time.
function rand(i: number, salt: number): number {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Pages where an award pop-up would be in the way: third-party embeds, payment
// and redemption flows, and live plan chat (someone may be mid-message). The
// award stays unseen and shows on the next page that isn't one of these.
const QUIET_PREFIXES = ["/embed", "/pay", "/redeem", "/chat"];

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export default function PointsEarned() {
  const pathname = usePathname() || "";
  const quiet = QUIET_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const [award, setAward] = useState<PointsUnseen | null>(null);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (quiet) return;
    let cancelled = false;
    const load = () => {
      try {
        if (!Parse.User.current()) return;
        Parse.Cloud.run("getPointsSummary")
          .then((s: { unseen?: PointsUnseen[]; balance?: number }) => {
            if (cancelled || !s?.unseen?.length) return;
            setBalance(s.balance || 0);
            setAward((cur) => cur ?? s.unseen![0]);
          })
          .catch(() => { /* non-fatal */ });
      } catch { /* Parse not initialized */ }
    };
    load();
    // A web check-in just landed: the award is written a moment later, so look
    // again shortly to celebrate it right where the guest is.
    const onEarned = () => { window.setTimeout(load, 1200); };
    window.addEventListener(POINTS_EVENT, onEarned);
    return () => {
      cancelled = true;
      window.removeEventListener(POINTS_EVENT, onEarned);
    };
  }, [quiet]);

  if (!award || quiet) return null;

  const dismiss = () => {
    const id = award.id;
    setAward(null);
    // Mark it seen first, then tell any header chip to pull the new balance
    // and nudge: the points land where people look for them.
    Parse.Cloud.run("markPointsSeen", { ids: [id] })
      .catch(() => {})
      .finally(() => window.dispatchEvent(new Event(POINTS_EVENT)));
  };

  const where = award.businessName || award.planTitle || "this plan";
  const regular = award.kind === "attend" && award.visitNumber === 3;

  if (!award.first) {
    return (
      <div role="status" style={S.banner}>
        <div style={S.bannerMark}>+{award.delta}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {regular ? `You're a regular at ${where}` : `+${award.delta} points`}
          </div>
          <div style={S.sub}>
            {awardLine(award)}
            {award.nextWorth ? ` · next visit worth ${award.nextWorth}` : ""}
          </div>
        </div>
        <Link href="/me#points" onClick={dismiss} style={S.link}>View</Link>
        <button type="button" onClick={dismiss} aria-label="Dismiss" style={S.x}>×</button>
      </div>
    );
  }

  return <Celebration award={award} balance={balance} onClose={dismiss} />;
}

function Celebration({
  award, balance, onClose,
}: {
  award: PointsUnseen;
  balance: number;
  onClose: () => void;
}) {
  const isHost = award.kind === "host";
  const calm = useMemo(() => prefersReducedMotion(), []);
  const [shown, setShown] = useState(calm ? award.delta : 0);
  const [explainer, setExplainer] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);

  // Keyboard: focus lands on the main button, Escape closes, Tab stays inside.
  useEffect(() => {
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !dialog.current) return;
      const items = Array.from(
        dialog.current.querySelectorAll<HTMLElement>("button, a[href]"),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Count up to the award.
  useEffect(() => {
    if (calm) return;
    let raf = 0;
    let t0: number | null = null;
    const step = (ts: number) => {
      if (t0 === null) t0 = ts;
      const k = Math.min(1, (ts - t0) / 900);
      setShown(Math.round(award.delta * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [award.delta, calm]);

  const pieces = useMemo(() => Array.from({ length: 46 }, (_, i) => ({
    left: 8 + rand(i, 1) * 84,
    color: CONFETTI[i % CONFETTI.length],
    dx: rand(i, 2) * 120 - 60,
    rot: rand(i, 3) * 720 - 360,
    delay: rand(i, 4) * 0.5,
    dur: 1.8 + rand(i, 5) * 1.2,
  })), []);

  const step = Math.min(award.visitNumber || 1, 5);
  const where = award.businessName || award.planTitle || "this plan";

  return (
    <div style={S.overlay} onClick={onClose}>
      <style>{CSS}</style>
      <div ref={dialog} role="dialog" aria-modal="true" aria-label="You earned points" style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={S.hero}>
          <button type="button" onClick={onClose} aria-label="Close" style={S.heroX}>×</button>
          {!calm && pieces.map((p, i) => (
            <i
              key={i}
              className="lp-cf"
              style={{
                left: `${p.left}%`, background: p.color,
                animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
                ["--dx" as string]: `${p.dx}px`, ["--rot" as string]: `${p.rot}deg`,
              }}
            />
          ))}
          <span style={S.badge}>{isHost ? "Your plan ran" : "Check-in confirmed"}</span>
          <div style={S.head}>{isHost ? "Nice hosting!" : "You showed up!"}</div>
          <div style={S.heroSub}>{award.planTitle || where}{isHost ? "" : award.businessName ? ` · ${award.businessName}` : ""}</div>
          <div className={calm ? undefined : "lp-pop"} style={S.num}>+{shown}</div>
          <div style={S.unit}>Leaf points</div>
        </div>

        <div style={S.body}>
          {isHost ? (
            <p style={S.copy}>Every person who shows up adds 3 more, up to 50 a plan. Host again to keep stacking.</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 4 }}>
                {LADDER.map((n, i) => {
                  const now = i + 1 === step;
                  const done = i + 1 < step;
                  return (
                    <div key={n} style={{ flex: 1, textAlign: "center" }}>
                      <div
                        className={now && !calm ? "lp-pop-late" : undefined}
                        style={{
                          width: 28, height: 28, borderRadius: "50%", margin: "0 auto 4px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 500,
                          background: now ? "#253a33" : done ? "#f3f7f5" : "#fff",
                          color: now ? "#c8f25a" : done ? "#253a33" : "#8b8578",
                          border: `1px solid ${now ? "#253a33" : "rgba(0,0,0,.15)"}`,
                        }}
                      >{done ? "✓" : n}</div>
                      <div style={{ fontSize: 10, color: now ? "#17150f" : "#8b8578" }}>
                        {now ? "Today" : i + 1 === step + 1 ? "Next" : i === 4 ? "Max" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p style={{ ...S.copy, marginTop: 8 }}>
                {awardLine(award)}.{award.nextWorth ? ` Come back and the next one is worth ${award.nextWorth}.` : ""}
              </p>
            </>
          )}

          <p style={S.balance}>Your balance: <b style={{ fontWeight: 600, color: "#17150f" }}>{balance} points</b></p>

          <div style={{ marginTop: 14 }}>
            <button ref={primary} type="button" onClick={onClose} style={{ ...S.primary, width: "100%" }}>
              {isHost ? "Host another" : "Keep going"}
            </button>
          </div>

          <button type="button" onClick={() => setExplainer((v) => !v)} style={S.what}>
            What are Leaf points?
          </button>
          {explainer && (
            <div style={S.how}>
              <p style={S.howP}>Earn them each time you check in at a plan, and when people show up to one you host.</p>
              <p style={S.howP}>The more you return to a place, the more each visit is worth.</p>
              <p style={S.howP}>Soon you&rsquo;ll spend them on ticket discounts.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.lp-cf{position:absolute;top:-10px;width:7px;height:11px;border-radius:2px;opacity:0;z-index:1;
  animation-name:lp-fall;animation-timing-function:ease-out;animation-fill-mode:forwards}
@keyframes lp-fall{0%{opacity:1;transform:translate(0,0) rotate(0)}
  100%{opacity:0;transform:translate(var(--dx),260px) rotate(var(--rot))}}
.lp-pop{animation:lp-pop .7s cubic-bezier(.2,1.6,.4,1) both}
.lp-pop-late{animation:lp-pop .6s .5s cubic-bezier(.2,1.6,.4,1) both}
@keyframes lp-pop{0%{transform:scale(.5);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
`;

const FONT = "var(--font-geist-sans, -apple-system, BlinkMacSystemFont, sans-serif)";

const S: Record<string, React.CSSProperties> = {
  banner: {
    position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 1000,
    width: "min(480px, calc(100vw - 24px))", display: "flex", alignItems: "center", gap: 12,
    background: "#fff", border: "1px solid rgba(0,0,0,.09)", borderRadius: 10, padding: "10px 12px",
    color: "#17150f", boxShadow: "0 6px 20px rgba(0,0,0,.08)", fontFamily: FONT,
  },
  bannerMark: {
    flex: "none", minWidth: 36, height: 36, borderRadius: 18, background: "#f3f7f5", color: "#253a33",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, padding: "0 6px",
  },
  sub: { fontSize: 11, color: "#8b8578" },
  link: { fontSize: 12, color: "#253a33", textDecoration: "underline", textUnderlineOffset: 2, whiteSpace: "nowrap" },
  x: { background: "transparent", border: "none", fontSize: 20, lineHeight: 1, color: "#8b8578", cursor: "pointer", padding: 2 },
  overlay: {
    position: "fixed", inset: 0, zIndex: 1000, background: "rgba(23,21,15,.55)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: FONT,
  },
  sheet: {
    position: "relative", width: "min(360px, 100%)", background: "#fff", borderRadius: 18,
    color: "#17150f", maxHeight: "calc(100vh - 32px)", overflowY: "auto", overflowX: "hidden",
  },
  hero: {
    position: "relative", background: "#253a33", color: "#f2f1ec", textAlign: "center",
    padding: "26px 20px 24px", overflow: "hidden",
  },
  heroX: {
    position: "absolute", top: 10, right: 12, zIndex: 3, background: "transparent", border: "none",
    color: "#a3aca6", fontSize: 22, lineHeight: 1, cursor: "pointer", padding: "0 4px",
  },
  badge: {
    position: "relative", zIndex: 2, display: "inline-block", fontSize: 11, fontWeight: 500, color: "#c8f25a",
    border: "1px solid rgba(200,242,90,.4)", borderRadius: 999, padding: "4px 11px",
  },
  head: { position: "relative", zIndex: 2, fontSize: 22, fontWeight: 600, margin: "12px 0 2px" },
  heroSub: { position: "relative", zIndex: 2, fontSize: 12, color: "#a3aca6" },
  num: {
    position: "relative", zIndex: 2, display: "inline-block", fontSize: 64, fontWeight: 600,
    lineHeight: 1, color: "#c8f25a", marginTop: 12,
  },
  unit: {
    position: "relative", zIndex: 2, fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase",
    color: "#f2f1ec", marginTop: 2,
  },
  body: { padding: "16px 18px 18px", textAlign: "center" },
  copy: { fontSize: 13, lineHeight: 1.5, margin: 0 },
  balance: { fontSize: 12, color: "#6f6a5f", margin: "12px 0 0" },
  ghost: {
    flex: 1, textAlign: "center", fontSize: 12, fontWeight: 500, padding: "11px 14px", borderRadius: 9,
    border: "1px solid rgba(0,0,0,.2)", color: "#17150f", background: "#fff", textDecoration: "none",
  },
  primary: {
    flex: 1, fontSize: 12, fontWeight: 500, padding: "11px 14px", borderRadius: 9,
    border: "1px solid #253a33", color: "#fff", background: "#253a33", cursor: "pointer", fontFamily: FONT,
  },
  what: {
    display: "block", width: "100%", marginTop: 12, background: "none", border: "none", cursor: "pointer",
    fontSize: 11, color: "#6f6a5f", textDecoration: "underline", textUnderlineOffset: 2, fontFamily: FONT,
  },
  how: { background: "#faf9f7", borderRadius: 8, padding: 12, marginTop: 10, textAlign: "left" },
  howP: { fontSize: 12, color: "#6f6a5f", margin: "0 0 4px", lineHeight: 1.5 },
};
