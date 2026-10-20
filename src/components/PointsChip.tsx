"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { awardDetail, type PointsSummary } from "@/lib/points";

// The signed-in member's Leaf points, top right of a page header. A small
// "60 pts" chip; tapping it opens a popover with the balance, the places
// they're a regular at, and their latest awards, so nobody is sent away from
// what they were doing. Renders nothing for signed-out visitors or until the
// first points land.

export const POINTS_EVENT = "leaf:points-earned";

let cache: { at: number; data: PointsSummary } | null = null;
let inflight: Promise<PointsSummary | null> | null = null;

function loadPoints(force = false): Promise<PointsSummary | null> {
  if (!force && cache && Date.now() - cache.at < 30_000) return Promise.resolve(cache.data);
  if (inflight) return inflight;
  const p: Promise<PointsSummary | null> = Parse.Cloud.run("getPointsSummary")
    .then((data: PointsSummary) => {
      cache = { at: Date.now(), data };
      return data;
    })
    .catch(() => null)
    .finally(() => { inflight = null; });
  inflight = p;
  return p;
}

export default function PointsChip({ className }: { className?: string }) {
  const [points, setPoints] = useState<PointsSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const chipBtn = useRef<HTMLButtonElement>(null);
  // Where the popover sits, in viewport coordinates, so it stays on screen even
  // when the chip is not at the far right of a narrow header.
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const refresh = useCallback((force: boolean) => {
    try {
      if (!Parse.User.current()) return;
    } catch { return; }
    loadPoints(force).then((d) => { if (d) setPoints(d); });
  }, []);

  useEffect(() => {
    refresh(false);
    // An award was just dismissed: pull the new balance and nudge the chip.
    const onEarned = () => {
      cache = null;
      refresh(true);
      setBump(true);
      window.setTimeout(() => setBump(false), 700);
    };
    window.addEventListener(POINTS_EVENT, onEarned);
    return () => window.removeEventListener(POINTS_EVENT, onEarned);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onMove = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  if (!points || points.balance <= 0) return null;

  return (
    <div ref={wrap} className={className} style={S.wrap}>
      <style>{`@keyframes lp-bump{0%{transform:scale(1)}40%{transform:scale(1.18)}100%{transform:scale(1)}}`}</style>
      <button
        type="button"
        ref={chipBtn}
        onClick={() => {
          if (!open && chipBtn.current) {
            const r = chipBtn.current.getBoundingClientRect();
            const width = Math.min(264, window.innerWidth - 24);
            const left = Math.min(Math.max(r.right - width, 12), window.innerWidth - width - 12);
            setPos({ top: r.bottom + 8, left, width });
          }
          setOpen((v) => !v);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${points.balance} points, open my points`}
        style={{ ...S.chip, animation: bump ? "lp-bump .6s ease-out" : undefined }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none" }}>
          <circle cx="12" cy="12" r="11" fill="#253a33" />
          <path d="M12 5.8l1.9 4 4.3.5-3.2 3 .9 4.3-3.9-2.2-3.9 2.2.9-4.3-3.2-3 4.3-.5z" fill="#c8f25a" />
        </svg>
        {points.balance} pts
      </button>

      {open && pos && (
        <div
          role="dialog"
          aria-label="Your Leaf points"
          style={{ ...S.pop, top: pos.top, left: pos.left, width: pos.width }}
        >
          <div style={S.eyebrow}>Your Leaf points</div>
          <div>
            <span style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.1 }}>{points.balance}</span>{" "}
            <span style={S.muted}>points</span>
          </div>
          <div style={{ ...S.muted, marginTop: 2 }}>Ticket discounts are coming soon.</div>

          {points.businesses.slice(0, 3).map((b) => (
            <div key={b.id} style={S.row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5 }}>{b.name}</div>
                <div style={S.muted}>Visit {b.visits} · next visit worth {b.nextWorth}</div>
              </div>
              {b.regular && <span style={S.tag}>Regular</span>}
            </div>
          ))}

          {points.recent.slice(0, 3).map((r) => (
            <div key={r.id} style={S.row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5 }}>{r.planTitle || "Plan"}</div>
                <div style={S.muted}>{awardDetail(r)}</div>
              </div>
              <span style={S.tag}>{r.delta > 0 ? "+" : ""}{r.delta}</span>
            </div>
          ))}

          <Link href="/me#points" onClick={() => setOpen(false)} style={S.more}>See everything</Link>
        </div>
      )}
    </div>
  );
}

const FONT = "var(--font-geist-sans, -apple-system, BlinkMacSystemFont, sans-serif)";

const S: Record<string, React.CSSProperties> = {
  wrap: { position: "relative", display: "inline-block", fontFamily: FONT },
  chip: {
    display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, color: "#253a33", background: "#f3f7f5", cursor: "pointer",
    border: "1px solid rgba(0,0,0,.09)", borderRadius: 999, padding: "5px 11px", whiteSpace: "nowrap",
    fontFamily: FONT,
  },
  pop: {
    position: "fixed", zIndex: 60, textAlign: "left",
    background: "#fff", color: "#17150f", border: "1px solid rgba(0,0,0,.09)", borderRadius: 10,
    padding: 14, boxShadow: "0 10px 28px rgba(0,0,0,.12)",
  },
  eyebrow: {
    fontFamily: "var(--font-geist-mono, ui-monospace, monospace)", fontSize: 9.5, fontWeight: 500,
    letterSpacing: ".1em", textTransform: "uppercase", color: "#8b8578", marginBottom: 6,
  },
  muted: { fontSize: 10.5, color: "#8b8578" },
  row: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    padding: "9px 0 0", marginTop: 9, borderTop: "1px solid rgba(0,0,0,.07)",
  },
  tag: {
    fontSize: 10.5, fontWeight: 500, color: "#253a33", background: "#f3f7f5", borderRadius: 999,
    padding: "3px 9px", whiteSpace: "nowrap",
  },
  more: {
    display: "block", marginTop: 12, fontSize: 11, color: "#253a33", textDecoration: "underline",
    textUnderlineOffset: 2,
  },
};
