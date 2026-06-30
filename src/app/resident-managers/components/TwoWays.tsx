import { CTA, Eyebrow } from "./ui";
import Reveal from "./Reveal";

export default function TwoWays() {
  return (
    <section className="band-mint section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>Two ways to start</Eyebrow>
          <h2 className="h-lg">Start free today, or let us run it for you.</h2>
          <p className="lead">
            The free calendar is a no-risk first step. The demo is for the done-for-you
            Concierge service.
          </p>
        </Reveal>

        <div className="ways">
          <Reveal className="way">
            <h3 className="h-md" style={{ fontSize: "1.4rem" }}>
              Free calendar
            </h3>
            <div className="way__price" style={{ color: "var(--forest)" }}>
              $0
            </div>
            <p style={{ color: "var(--muted)" }}>
              Switch on your building&rsquo;s community calendar in minutes. Residents make
              plans and find local deals.
            </p>
            <ul>
              <li>Live in minutes</li>
              <li>Resident-led</li>
              <li>No app to download</li>
            </ul>
            <div className="cta-stack way__cta-stack">
              <CTA to="free" variant="ghost">
                Start free today
              </CTA>
              <a
                className="cta-stack__hint"
                href="/apartment"
                target="_blank"
                rel="noopener noreferrer"
              >
                See example calendar →
              </a>
            </div>
          </Reveal>

          <Reveal className="way way--reco" delay={100}>
            <span className="way__tag">Recommended</span>
            <h3 className="h-md" style={{ fontSize: "1.4rem" }}>
              Concierge
            </h3>
            <div className="way__price" style={{ color: "var(--amber)" }}>
              $499<span style={{ fontSize: "1rem", fontWeight: 400 }}>/mo</span>
            </div>
            <p
              style={{
                color: "var(--amber)",
                fontSize: "0.85rem",
                fontWeight: 600,
                letterSpacing: "0.04em",
                marginTop: 2,
                marginBottom: 8,
              }}
            >
              Done-for-you
            </p>
            <p style={{ color: "var(--light)" }}>
              We plan and run one great resident event a month, start to finish. Your first
              event is free.
            </p>
            <ul>
              <li>A dedicated concierge</li>
              <li>Vendors, promo &amp; RSVPs handled</li>
              <li>Local businesses sponsor events</li>
            </ul>
            <CTA to="demo" variant="primary" arrow>
              Book a demo
            </CTA>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
