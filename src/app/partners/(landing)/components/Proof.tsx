import { Plaque, SectionHead } from "./ui";
import Reveal from "./Reveal";

const proof = [
  {
    fig: "+67%",
    line: "Repeat customers spend 67% more than first-timers.",
    src: "Bain & Company",
  },
  {
    fig: "25–95%",
    line: "Profit lift from a 5% increase in customer retention.",
    src: "Bain & Company / HBR",
  },
  {
    fig: "44%",
    line: "of revenue comes from repeat customers — just 21% of the base.",
    src: "Gorgias",
  },
  {
    fig: "67%",
    line: "of consumers trust local businesses over internet-only brands.",
    src: "Uberall",
  },
  {
    fig: "#1",
    line:
      "Personal, local recommendations remain the most trusted way people choose where to go.",
    src: "Consumer trust research",
  },
  {
    fig: "70%",
    line: "of people shop local specifically to support their community.",
    src: "2025–26 consumer data",
  },
];

export default function Proof() {
  return (
    <section className="section band-alt">
      <div className="container">
        <Reveal>
          <SectionHead
            eyebrow="The evidence"
            title="The math is on your side."
            lead={
              <>
                Reaching nearby residents and turning them into regulars isn&rsquo;t a
                nice-to-have &mdash; it&rsquo;s the most profitable customer you can get.
              </>
            }
          />
        </Reveal>

        <div className="proof-grid">
          {proof.map((p, i) => (
            <Reveal className="proof" key={p.fig + i} delay={(i % 3) * 90}>
              <div className="proof__fig">{p.fig}</div>
              <p className="proof__line">{p.line}</p>
              <Plaque>{p.src}</Plaque>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
