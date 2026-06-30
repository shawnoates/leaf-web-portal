import { CTA, Eyebrow, Plaque } from "./ui";
import Reveal from "./Reveal";

const steps = [
  {
    n: "1",
    h: "We plan it",
    b: "A dedicated concierge plans one resident event a month, curated to your building.",
  },
  {
    n: "2",
    h: "We run it",
    b: "Vendors booked, flyers made, RSVPs and reminders handled — and local businesses help sponsor.",
  },
  {
    n: "3",
    h: "They show up",
    b: "Residents connect, the building feels like home, and renewals follow. Your team does nothing.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="band-forest section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>How Leaf works</Eyebrow>
          <h2 className="h-lg">We run the fun. You keep your tools.</h2>
          <p className="lead">
            Leaf is the <strong style={{ color: "#fff" }}>social</strong> layer of your
            building &mdash; deliberately separate from the utility apps residents use to pay
            rent and file tickets. Keep all of that. We do the part those tools can&rsquo;t.
          </p>
        </Reveal>

        <div className="versus">
          <Reveal className="card card--mint" style={{ color: "var(--ink)" }}>
            <h3 className="h-md" style={{ fontSize: "1.25rem" }}>
              Utility &mdash; keep what you have
            </h3>
            <p style={{ color: "var(--muted)", margin: "6px 0 0", fontSize: "0.92rem" }}>
              Residents open these because they have to.
            </p>
            <ul className="checklist checklist--keep">
              <li>Rent payments</li>
              <li>Maintenance tickets</li>
              <li>Package lockers</li>
              <li>Access &amp; intercom</li>
              <li>Your PMS / resident app</li>
            </ul>
          </Reveal>

          <div className="versus__mid">
            <div className="vs-pill">+</div>
          </div>

          <Reveal className="card" style={{ color: "var(--ink)" }} delay={100}>
            <h3 className="h-md" style={{ fontSize: "1.25rem", color: "var(--forest)" }}>
              Social &mdash; Leaf does this
            </h3>
            <p style={{ color: "var(--muted)", margin: "6px 0 0", fontSize: "0.92rem" }}>
              The part residents actually <em>want</em> to open.
            </p>
            <ul className="checklist">
              <li>Events residents attend</li>
              <li>Neighbor connections</li>
              <li>A community calendar</li>
              <li>Local perks &amp; deals</li>
              <li>Done-for-you, every month</li>
            </ul>
          </Reveal>
        </div>

        <Reveal style={{ marginTop: 22 }}>
          <p style={{ color: "var(--light)", maxWidth: "60ch" }}>
            The biggest &ldquo;resident app&rdquo; adoption story in our space was driven by
            parcel lockers, intercoms, and rent &mdash; not community. Utility and belonging
            are different jobs. We keep them separate so the social side stays something
            residents love.
          </p>
          <div style={{ marginTop: 12 }}>
            <Plaque>Flamingo &middot; Atlas Oakland case study</Plaque>
          </div>
        </Reveal>

        <div className="steps">
          {steps.map((s, i) => (
            <Reveal className="step" key={s.n} delay={i * 90}>
              <div className="step__n">{s.n}</div>
              <h3>{s.h}</h3>
              <p style={{ color: "var(--light)" }}>{s.b}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="inline-cta">
          <CTA to="demo" variant="primary" arrow>
            Book a Concierge demo
          </CTA>
        </Reveal>
      </div>
    </section>
  );
}
