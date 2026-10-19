"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { awardLine, type PointsUnseen } from "@/lib/points";

// "You earned points", shown on the first Leaf page someone opens after an
// award. The very first award opens the full sheet (what points are); later
// ones are a quiet banner. The server stamps seenAt on dismiss, so it shows
// once per award across devices. Mounted once in the root layout; signed-out
// visitors never see it.

const LADDER = [10, 20, 30, 40, 50];

export default function PointsEarned() {
  const [award, setAward] = useState<PointsUnseen | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      if (!Parse.User.current()) return;
      Parse.Cloud.run("getPointsSummary")
        .then((s: { unseen?: PointsUnseen[] }) => {
          if (!cancelled && s?.unseen?.length) setAward(s.unseen[0]);
        })
        .catch(() => { /* non-fatal */ });
    } catch { /* Parse not initialized */ }
    return () => { cancelled = true; };
  }, []);

  if (!award) return null;

  const dismiss = () => {
    const id = award.id;
    setAward(null);
    Parse.Cloud.run("markPointsSeen", { ids: [id] }).catch(() => {});
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

  const step = Math.min(award.visitNumber || 1, 5);
  return (
    <div style={S.overlay} onClick={dismiss}>
      <div role="dialog" aria-modal="true" aria-label="You earned points" style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={dismiss} aria-label="Close" style={{ ...S.x, position: "absolute", top: 12, right: 14 }}>×</button>
        <div style={S.chip}>{award.kind === "host" ? "Your plan ran" : "Check-in confirmed"}</div>
        <div style={{ ...S.sub, marginTop: 12 }}>{award.planTitle}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "2px 0 14px" }}>
          <span style={{ fontSize: 40, fontWeight: 500, lineHeight: 1.1 }}>+{award.delta}</span>
          <span style={{ fontSize: 14, color: "#6f6a5f" }}>Leaf points</span>
        </div>

        {award.kind === "attend" && (
          <>
            <div style={{ display: "flex", gap: 4 }}>
              {LADDER.map((n, i) => {
                const now = i + 1 === step;
                const done = i + 1 < step;
                return (
                  <div key={n} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", margin: "0 auto 4px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 500,
                      background: now ? "#253a33" : done ? "#f3f7f5" : "#fff",
                      color: now ? "#fff" : done ? "#253a33" : "#8b8578",
                      border: `1px solid ${now ? "#253a33" : "rgba(0,0,0,.15)"}`,
                    }}>{done ? "✓" : n}</div>
                    <div style={{ fontSize: 10, color: now ? "#17150f" : "#8b8578" }}>{now ? "Today" : i + 2 === step + 1 ? "Next" : ""}</div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 13, margin: "10px 0 0" }}>
              {awardLine(award)}.{award.nextWorth ? ` Come back and your next visit is worth ${award.nextWorth}.` : ""}
            </p>
          </>
        )}

        <div style={S.how}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>What are Leaf points?</div>
          <p style={S.howP}>Earn them each time you check in at a plan, and when people show up to one you host.</p>
          <p style={S.howP}>The more you return to a place, the more each visit is worth.</p>
          <p style={S.howP}>Soon you&rsquo;ll spend them on ticket discounts.</p>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <Link href="/me#points" onClick={dismiss} style={S.ghost}>See my points</Link>
          <button type="button" onClick={dismiss} style={S.primary}>Got it</button>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  banner: {
    position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 1000,
    width: "min(480px, calc(100vw - 24px))", display: "flex", alignItems: "center", gap: 12,
    background: "#fff", border: "1px solid rgba(0,0,0,.09)", borderRadius: 10, padding: "10px 12px",
    color: "#17150f", boxShadow: "0 6px 20px rgba(0,0,0,.08)",
    fontFamily: "var(--font-geist-sans, -apple-system, BlinkMacSystemFont, sans-serif)",
  },
  bannerMark: {
    flex: "none", minWidth: 36, height: 36, borderRadius: 18, background: "#f3f7f5", color: "#253a33",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, padding: "0 6px",
  },
  sub: { fontSize: 11, color: "#8b8578" },
  link: { fontSize: 12, color: "#253a33", textDecoration: "underline", textUnderlineOffset: 2, whiteSpace: "nowrap" },
  x: { background: "transparent", border: "none", fontSize: 20, lineHeight: 1, color: "#8b8578", cursor: "pointer", padding: 2 },
  overlay: {
    position: "fixed", inset: 0, zIndex: 1000, background: "rgba(23,21,15,.45)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    fontFamily: "var(--font-geist-sans, -apple-system, BlinkMacSystemFont, sans-serif)",
  },
  sheet: {
    position: "relative", width: "min(380px, 100%)", background: "#fff", borderRadius: 14, padding: 20,
    color: "#17150f", maxHeight: "calc(100vh - 32px)", overflowY: "auto",
  },
  chip: {
    display: "inline-block", fontSize: 11, fontWeight: 500, color: "#253a33", background: "#f3f7f5",
    border: "1px solid rgba(0,0,0,.09)", borderRadius: 999, padding: "3px 10px",
  },
  how: { background: "#faf9f7", borderRadius: 8, padding: 12, marginTop: 14 },
  howP: { fontSize: 12, color: "#6f6a5f", margin: "0 0 4px", lineHeight: 1.5 },
  ghost: {
    fontSize: 12, fontWeight: 500, padding: "9px 14px", borderRadius: 7, border: "1px solid rgba(0,0,0,.15)",
    color: "#17150f", background: "#fff", textDecoration: "none",
  },
  primary: {
    fontSize: 12, fontWeight: 500, padding: "9px 14px", borderRadius: 7, border: "1px solid #253a33",
    color: "#fff", background: "#253a33", cursor: "pointer",
  },
};
