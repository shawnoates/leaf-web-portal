import { CTA, Eyebrow, TrustStrip } from "./ui";
import Reveal from "./Reveal";

function HeroArt() {
  return (
    <div
      className="hero__art"
      role="img"
      aria-label="Friends laughing over drinks at a bar"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/creators-hero.jpg" alt="" className="hero__photo" />
      <div className="hero__play" aria-hidden="true">
        <span className="hero__play-btn">
          <svg width="28" height="28" viewBox="0 0 24 24">
            <path fill="#fff" d="M8 5v14l11-7z" />
          </svg>
        </span>
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
