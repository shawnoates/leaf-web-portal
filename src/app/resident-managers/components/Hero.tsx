import { CTA, Eyebrow, TrustStrip } from "./ui";
import Reveal from "./Reveal";

function HeroArt() {
  return (
    <div className="hero__art" role="img" aria-label="Neighbors gathering at a building event">
      <svg className="hero__people" viewBox="0 0 400 440" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id="rm-glow" cx="30%" cy="18%" r="70%">
            <stop offset="0%" stopColor="#cdeede" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#cdeede" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="440" fill="url(#rm-glow)" />
        <path
          d="M0 60 Q100 100 200 64 T400 70"
          stroke="#95d5b2"
          strokeWidth="1.5"
          fill="none"
          opacity="0.5"
        />
        {[40, 100, 160, 220, 280, 340].map((x, i) => (
          <circle key={i} cx={x} cy={i % 2 ? 86 : 78} r="3.4" fill="#e8a33d" opacity="0.95" />
        ))}
        <ellipse cx="200" cy="360" rx="150" ry="34" fill="#11331f" opacity="0.55" />
        {[
          { x: 96, c: "#bfe6cf" },
          { x: 160, c: "#9fd8b8" },
          { x: 224, c: "#cdeede" },
          { x: 288, c: "#86c8a3" },
        ].map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${250 + (i % 2) * 14})`}>
            <circle cx="0" cy="0" r="22" fill={p.c} />
            <path d="M-34 96 Q0 40 34 96 Z" fill={p.c} opacity="0.92" />
          </g>
        ))}
        <g stroke="#e8a33d" strokeWidth="3" opacity="0.85">
          <line x1="120" y1="232" x2="132" y2="218" />
          <line x1="270" y1="232" x2="258" y2="218" />
        </g>
      </svg>
      <span className="hero__art-note">Swap in a real photo of one of your buildings</span>
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
            Leaf runs the social side of your building for you &mdash; one great resident
            event a month, fully done&#8209;for&#8209;you &mdash; so residents connect, stay
            longer, and your NOI holds. Your team does nothing.
          </p>
          <div className="cta-row" style={{ marginTop: 28 }}>
            <CTA to="demo" variant="primary" arrow>
              Book a Concierge demo
            </CTA>
            <CTA to="free" variant="ghost">
              Start your calendar free
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
