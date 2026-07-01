import { CTA, Eyebrow, Plaque } from "./ui";
import Reveal from "./Reveal";

const steps = [
  {
    n: "1",
    h: "Tell us your offer",
    b: "Share a deal or an event you’d host. We help shape it to land with residents.",
  },
  {
    n: "2",
    h: "We bring the people",
    b: "We place your deal in nearby buildings, or promote and fill your event — RSVPs and turnout handled.",
  },
  {
    n: "3",
    h: "They come back",
    b: "Neighbors discover you, walk in, and become regulars. Roll out to more buildings as it works.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="band-forest section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="h-lg">It&rsquo;s a recommendation, not an ad.</h2>
          <p className="lead">
            Residents see you{" "}
            <strong style={{ color: "#fff" }}>inside their building&rsquo;s community</strong>{" "}
            &mdash; a place they trust, alongside their neighbors &mdash; not as one more ad
            they scroll past. That&rsquo;s a fundamentally warmer way to be found.
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

        <Reveal style={{ marginTop: 30 }}>
          <p style={{ color: "var(--light)", maxWidth: "62ch" }}>
            Personal, local recommendations are still the most trusted way people choose
            where to go &mdash; far more than ads or even online reviews. Leaf OS puts you
            on the right side of that: discovered by neighbors, in the community they trust.
          </p>
          <div style={{ marginTop: 12 }}>
            <Plaque>Local consumer trust research</Plaque>
          </div>
          <div className="inline-cta">
            <CTA to="partner" variant="primary" arrow>
              Become a partner
            </CTA>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
