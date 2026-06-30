import { CTA, Eyebrow, Plaque } from "./ui";
import Reveal from "./Reveal";

export default function Insight() {
  return (
    <section className="band-mint section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>Why it pays</Eyebrow>
          <h2 className="h-lg">An ad gets you a click. A neighbor gets you a regular.</h2>
          <p className="lead">
            The money isn&rsquo;t in one-time foot traffic &mdash; it&rsquo;s in repeat
            visits. And the closer someone lives, the more often they come back.
          </p>
        </Reveal>

        <div className="grid grid-2" style={{ alignItems: "stretch" }}>
          <Reveal
            className="card"
            style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}
          >
            <div className="bigstat" style={{ padding: 0 }}>
              <div
                className="bigstat__num"
                style={{ fontSize: "clamp(3.6rem, 11vw, 6.4rem)" }}
              >
                25&ndash;<em>95%</em>
              </div>
              <p className="bigstat__cap">
                more profit from just a <strong>5% increase in repeat customers.</strong>
              </p>
              <div style={{ marginTop: 18 }}>
                <Plaque>Bain &amp; Company &middot; HBR</Plaque>
              </div>
            </div>
          </Reveal>

          <Reveal className="card" delay={100}>
            <h3 className="h-md" style={{ marginBottom: 6, fontSize: "1.3rem" }}>
              Regulars are a small group that drives most of the revenue
            </h3>
            <p style={{ color: "var(--muted)", margin: "0 0 22px", fontSize: "0.92rem" }}>
              Share of a typical business&rsquo;s customers vs. share of revenue.
            </p>
            <div className="barpair">
              <div className="barpair__row">
                <span>Repeat customers</span>
                <span className="barpair__track">
                  <span
                    className="barpair__fill"
                    style={{ width: "21%", background: "var(--mid)" }}
                  />
                </span>
                <b>21%</b>
              </div>
              <div className="barpair__row">
                <span>of all revenue</span>
                <span className="barpair__track">
                  <span
                    className="barpair__fill"
                    style={{ width: "44%", background: "var(--amber)" }}
                  />
                </span>
                <b>44%</b>
              </div>
            </div>
            <p style={{ marginTop: 22, fontWeight: 700, color: "var(--forest)" }}>
              The residents next door are the most likely people to become those regulars.
            </p>
            <div style={{ marginTop: 10 }}>
              <Plaque>Gorgias &middot; repeat-customer data</Plaque>
            </div>
          </Reveal>
        </div>

        <Reveal className="inline-cta">
          <CTA to="partner" variant="primary" arrow>
            Turn neighbors into regulars
          </CTA>
        </Reveal>
      </div>
    </section>
  );
}
