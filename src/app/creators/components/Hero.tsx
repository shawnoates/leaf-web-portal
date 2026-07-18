import { CTA, Eyebrow, TrustStrip } from "./ui";
import Reveal from "./Reveal";

/**
 * No dedicated hero photo exists for /creators, so the art panel is a
 * CSS-composed mock that tells the product story: one typed sentence
 * becomes a plan, and the RSVPs say yes.
 */
function HeroArt() {
  return (
    <div
      className="hero__art"
      role="img"
      aria-label="A typed sentence in Leaf becoming a plan with RSVPs"
    >
      <div className="mock">
        <div className="mock__type">
          cozy dinner for 8, everyone brings a dish
          <span className="mock__caret"> ▍</span>
        </div>
        <div className="mock__spacer" />
        <div className="mock__card">
          <div className="mock__title">Cozy dinner for 8</div>
          <div className="mock__meta">Saturday · 7:30pm · everyone brings a dish</div>
          <div className="mock__rsvps">
            <div className="mock__faces">
              <span className="mock__face" style={{ background: "#2d6a4f" }}>
                M
              </span>
              <span className="mock__face" style={{ background: "#40916c" }}>
                J
              </span>
              <span className="mock__face" style={{ background: "#e8a33d" }}>
                A
              </span>
              <span className="mock__face" style={{ background: "#1b4332" }}>
                +5
              </span>
            </div>
            <span className="mock__yes">8 going</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section id="top" className="hero band-paper section">
      <div className="container hero__grid">
        <Reveal>
          <Eyebrow>For creators &amp; hosts</Eyebrow>
          <h1 className="h-xl">
            Get paid to document{" "}
            <span className="underline-amber">a good night.</span>
          </h1>
          <p className="lead" style={{ marginTop: 22 }}>
            Leaf partners with hosts and creators who make real gatherings happen &mdash;
            dinners, run clubs, game nights, rooftop hangs. You plan it through Leaf, film
            what happens, and we pay you for the video and the post.
          </p>
          <p
            style={{
              marginTop: 14,
              color: "var(--mid)",
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            1k followers is plenty.
          </p>
          <div className="cta-row cta-row--solo" style={{ marginTop: 28 }}>
            <CTA variant="primary" arrow>
              Partner with us
            </CTA>
          </div>
          <TrustStrip />
        </Reveal>

        <Reveal delay={120}>
          <div style={{ position: "relative" }}>
            <HeroArt />
            <div className="chip">
              <div className="chip__big">$50&ndash;150 / video</div>
              <div className="chip__label">
                Paid via Venmo or Zelle within 24 hours of posting &mdash; plus a bonus if it
                performs.
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
