import Reveal from "../../resident-managers/components/Reveal";

/**
 * Rendered open rather than as an accordion. On a free offer, hiding
 * the answer to "why is it free" behind a click is exactly the wrong
 * shape — the answers are short enough to just say.
 *
 * "Why is it free" and "What happens to our information" are written
 * straighter and shorter than anything else on the page on purpose.
 * Hedging on either one reads as a hidden cost.
 */
const items = [
  {
    q: "Why is it free?",
    a: "Leaf is building a calendar for every neighborhood. Real gatherings make it useful to everyone in the area, including your church. There's no trial and no card.",
  },
  {
    q: "Is Leaf a Christian company?",
    a: "No — Leaf is a community platform, not a ministry. We don't touch your teaching, your theology, or your membership.",
  },
  {
    q: "Do members need an account?",
    a: "To post, yes. To look, no — anyone can open your calendar from a link.",
  },
  {
    q: "What happens to our information?",
    a: "We publish what you choose to publish. We don't take your membership roster and we don't sell anything about your congregation.",
  },
  {
    q: "Will this make more work for our staff?",
    a: "That's the point of it being member-led. Approve the occasional public post; that's the whole job.",
  },
];

export default function Faq() {
  return (
    <section className="band-paper section">
      <div className="container faq">
        <Reveal className="section-head" style={{ marginBottom: 30 }}>
          <h2 className="h-lg">What&rsquo;s the catch?</h2>
        </Reveal>
        <dl className="faq__list">
          {items.map((it, i) => (
            <Reveal className="faq__item" key={it.q} delay={(i % 3) * 70}>
              <dt>{it.q}</dt>
              <dd>{it.a}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
