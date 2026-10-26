import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How Leaf points work",
  description:
    "Earn Leaf points by showing up to plans and hosting them. The more you return to a place, the more each visit is worth.",
};


const INK = "#17150f";
const BODY = "#6f6a5f";
const MUTED = "#8b8578";
const GREEN = "#253a33";
const TINT = "#f3f7f5";
const LINE = "rgba(0,0,0,.09)";

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-geist-mono, ui-monospace, monospace)",
  fontSize: 10,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: MUTED,
  margin: "0 0 10px",
};
const h2: React.CSSProperties = { fontSize: 22, fontWeight: 500, margin: "0 0 10px", color: INK };
const p: React.CSSProperties = { fontSize: 15, lineHeight: 1.65, color: BODY, margin: "0 0 12px" };

export default function PointsPage() {
  return (
    <main style={{ background: "#fff", color: INK, minHeight: "100vh" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 22px 80px" }}>
        <Link href="/me" style={{ fontSize: 12, color: BODY, textDecoration: "none" }}>
          &larr; Back to Leaf
        </Link>

        <p style={{ ...eyebrow, marginTop: 32 }}>Leaf points</p>
        <h1 style={{ fontSize: 36, fontWeight: 500, lineHeight: 1.15, margin: "0 0 14px", letterSpacing: "-0.02em" }}>
          Show up, earn points.
        </h1>
        <p style={{ ...p, fontSize: 17 }}>
          Leaf points reward the things that make a community work: going to plans and hosting them.
          The more you return to a place, the more each visit is worth.
        </p>

        <section style={{ marginTop: 40 }}>
          <p style={eyebrow}>Going to plans</p>
          <h2 style={h2}>Check in, and earn more as you return</h2>
          <p style={p}>
            Check in at a plan and you earn points. The more often you go back to the same place, the more each
            visit is worth, so showing up regularly is what counts.
          </p>
        </section>

        <section style={{ marginTop: 40 }}>
          <p style={eyebrow}>How to check in</p>
          <h2 style={h2}>Be there, then tap I&rsquo;m here</h2>
          <p style={p}>
            Check-in opens 30 minutes before a plan starts and closes an hour after it starts. You need to be
            at the venue.
          </p>
          <p style={p}>
            In the Leaf app you check in at the plan. On the web, open your plan and tap{" "}
            <b style={{ color: INK, fontWeight: 500 }}>I&rsquo;m here</b>; your browser shares your location so
            Leaf can confirm you&rsquo;re at the venue. If you RSVP&rsquo;d by text, we&rsquo;ll text you a link
            when the plan starts.
          </p>
        </section>

        <section style={{ marginTop: 40 }}>
          <p style={eyebrow}>Hosting</p>
          <h2 style={h2}>Host a plan, earn when people come</h2>
          <p style={p}>
            When a plan you host has run, you earn points, and the more people who show up, the more you earn.
            People count once they&rsquo;ve checked in at the plan themselves. A plan nobody checked in at earns
            nothing, and your own accounts don&rsquo;t count.
          </p>
          <p style={p}>Points for a hosted plan arrive a few hours after it ends.</p>
        </section>

        <section style={{ marginTop: 40 }}>
          <p style={eyebrow}>A small extra</p>
          <h2 style={h2}>Say hello in the plan chat</h2>
          <p style={p}>
            Chatting in a plan after you&rsquo;ve checked in can earn a small bonus, once per plan.
          </p>
        </section>

        <section style={{ marginTop: 40 }}>
          <p style={eyebrow}>What they&rsquo;re for</p>
          <h2 style={h2}>Ticket discounts are coming</h2>
          <p style={p}>
            Soon you&rsquo;ll be able to use your points toward tickets to ticketed plans. For now they&rsquo;re
            yours to collect, and you can always see your balance at the top of the page.
          </p>
        </section>

        <div
          style={{
            marginTop: 48, background: TINT, border: `1px solid ${LINE}`, borderRadius: 12, padding: "20px 22px",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, color: GREEN }}>Ready to earn your first points?</div>
            <div style={{ fontSize: 13, color: BODY, marginTop: 2 }}>Find a plan and check in when you get there.</div>
          </div>
          <Link
            href="/me"
            style={{
              background: GREEN, color: "#fff", fontSize: 13, fontWeight: 500, padding: "12px 18px",
              borderRadius: 9, textDecoration: "none", whiteSpace: "nowrap",
            }}
          >
            Open Leaf
          </Link>
        </div>
      </div>
    </main>
  );
}
