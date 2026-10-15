import { CTA, SectionHead } from "./ui";
import Reveal from "./Reveal";
import { COPY, type Kind } from "./copy";

/**
 * "What it costs", side by side: the first one (free, or every ticket dollar
 * theirs) and every one after ($6 per RSVP for bars; Leaf's $6 a ticket for
 * shops and studios). The words are in copy.ts. Anything custom goes to a
 * partner manager.
 */
export default function Offer({ kind }: { kind: Kind }) {
  const c = COPY[kind];
  const [first, after] = c.offers;
  return (
    <section id="offer" className="section">
      <div className="container">
        <Reveal>
          <SectionHead center eyebrow="What it costs" title={<>{c.offerTitle}</>} lead={c.offerLead} />
        </Reveal>

        <div className="offer-grid">
          <Reveal className="offer offer--dark on-dark">
            {first.tag && <span className="offer__tag">{first.tag}</span>}
            <div className="offer__kind">{first.kind}</div>
            <div className="offer__price">
              <span className="offer__amount">{first.amount}</span>
              <span className="offer__per">{first.per}</span>
            </div>
            <p className="offer__desc">{first.desc}</p>
            <ul className="offer__list">
              {first.list.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <div className="offer__cta">
              <CTA to="join" variant="primary" arrow>
                {c.cta}
              </CTA>
            </div>
          </Reveal>

          <Reveal className="offer" delay={100}>
            <div className="offer__kind">{after.kind}</div>
            <div className="offer__price">
              <span className="offer__amount">{after.amount}</span>
              <span className="offer__per">{after.per}</span>
            </div>
            <p className="offer__desc">{after.desc}</p>
            <ul className="offer__list">
              {after.list.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal className="offer-notes">
          <p>
            Partners can also post deals on their neighborhood&rsquo;s calendar from their
            dashboard: $20 a month, charged once it&rsquo;s approved.
          </p>
          <p>
            Want something custom, or several locations?{" "}
            <strong>Talk to a partner manager.</strong>
          </p>
          <div className="inline-cta" style={{ marginTop: 20 }}>
            <CTA to="manager" variant="ghost" arrow>
              Talk to a partner manager
            </CTA>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
