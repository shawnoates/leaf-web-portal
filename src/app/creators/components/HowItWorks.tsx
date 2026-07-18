import { CTA, Eyebrow } from "./ui";
import Reveal from "./Reveal";

const steps = [
  {
    n: "1",
    h: "Plan something real",
    b: "Type one sentence into Leaf — “cozy dinner for 8, everyone brings a dish” — and it becomes a plan with an invite your people RSVP to.",
  },
  {
    n: "2",
    h: "Film the night, not the app",
    b: "Phone footage of your people showing up. Faces, the table, the toast. We send a one-page brief and 100 caption ideas; the voice is all yours.",
  },
  {
    n: "3",
    h: "Post it. Get paid",
    b: "Flat fee per video within 24 hours of posting, plus a bonus if it performs.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="band-forest section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="h-lg">Three steps. One good night.</h2>
          <p className="lead">
            You&rsquo;re not making an ad. You&rsquo;re documenting a gathering you were going
            to have anyway &mdash; and getting paid for the video.
          </p>
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
          <CTA variant="primary" arrow>
            Partner with us
          </CTA>
        </Reveal>
      </div>
    </section>
  );
}
