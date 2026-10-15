import { CTA, Plaque, SectionHead } from "./ui";
import Reveal from "./Reveal";
import { COPY, type Kind } from "./copy";

export default function HowItWorks({ kind }: { kind: Kind }) {
  const steps = COPY[kind].steps;
  return (
    <section id="how" className="section band-alt">
      <div className="container">
        <Reveal>
          <SectionHead
            eyebrow="How it works"
            title={<>It&rsquo;s a recommendation, not an ad.</>}
            lead={
              <>
                Residents see you inside their building&rsquo;s community, a place they
                trust, alongside their neighbors. Not as one more ad they scroll past.
                That&rsquo;s a fundamentally warmer way to be found.
              </>
            }
          />
        </Reveal>

        <div className="steps">
          {steps.map((s, i) => (
            <Reveal className="step" key={s.n} delay={i * 90}>
              <div className="step__n">{s.n}</div>
              <h3 className="step__title">{s.h}</h3>
              <p className="step__body">{s.b}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="trust-note">
          <span className="trust-note__mark" aria-hidden="true">
            &ldquo;
          </span>
          <div>
            <p>
              Personal, local recommendations are still the most trusted way people choose
              where to go, far more than ads or even online reviews. Leaf OS puts you
              on the right side of that: discovered by neighbors, in the community they trust.
            </p>
            <Plaque>Local consumer trust research</Plaque>
            <div className="inline-cta" style={{ marginTop: 28 }}>
              <CTA to="join" variant="primary" arrow>
                {COPY[kind].cta}
              </CTA>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
