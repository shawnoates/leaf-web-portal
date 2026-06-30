import { CTA, Eyebrow, TrustStrip } from "./ui";
import Reveal from "./Reveal";

function HeroArt() {
  return (
    <div className="hero__art" role="img" aria-label="Neighbors gathering at a building event">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/resident-managers-hero.png"
        alt=""
        className="hero__photo"
      />
    </div>
  );
}

export default function Hero() {
  return (
    <section id="top" className="hero band-paper section">
      <div className="container hero__grid">
        <Reveal>
          <Eyebrow>For property &amp; resident managers</Eyebrow>
          <h1 className="h-xl">
            Neighbors who know each other{" "}
            <span className="underline-amber">don&rsquo;t leave.</span>
          </h1>
          <p className="lead" style={{ marginTop: 22 }}>
            Leaf OS runs the social side of your building for you &mdash; one great resident
            event a month, fully done&#8209;for&#8209;you &mdash; so residents connect, stay
            longer, and your NOI holds. Your team does nothing.
          </p>
          <div className="cta-row" style={{ marginTop: 28 }}>
            <div className="cta-stack">
              <CTA to="free" variant="ghost">
                Start your calendar free
              </CTA>
              <a className="cta-stack__hint" href="/apartment">
                See example calendar →
              </a>
            </div>
            <CTA to="demo" variant="primary" arrow>
              Book a demo
            </CTA>
          </div>
          <TrustStrip />
        </Reveal>

        <Reveal delay={120}>
          <div style={{ position: "relative" }}>
            <HeroArt />
            <div className="chip">
              <div className="chip__big">#1 driver of renewals</div>
              <div className="chip__label">
                Across 1.6M resident surveys, &ldquo;sense of community&rdquo; ranks #1 &mdash;
                ahead of price.
              </div>
              <div style={{ marginTop: 10 }}>
                <span className="plaque">
                  <span className="plaque__dot" />
                  SatisFacts &middot; Ball State
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
