import { CTA, Eyebrow, Plaque } from "./ui";
import Reveal from "./Reveal";

const drivers = [
  { name: "Sense of community", w: 100, hi: 1 },
  { name: "Apartment condition", w: 82 },
  { name: "Community events", w: 70, hi: 2 },
  { name: "Neighbors", w: 60, hi: 2 },
  { name: "Office staff", w: 50 },
];

export default function Insight() {
  return (
    <section id="why" className="band-mint section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>The insight</Eyebrow>
          <h2 className="h-lg">
            Residents don&rsquo;t renew for the gym. They renew for the people.
          </h2>
          <p className="lead">
            When researchers ranked what actually drives renewals, the top answer wasn&rsquo;t
            price, finishes, or amenities. It was belonging.
          </p>
        </Reveal>

        <div className="grid grid-2" style={{ alignItems: "stretch" }}>
          <Reveal className="card">
            <h3 className="h-md" style={{ marginBottom: 6 }}>
              Top drivers of lease renewals
            </h3>
            <p style={{ color: "var(--muted)", margin: "0 0 22px", fontSize: "0.92rem" }}>
              Ranked from 1.6M resident surveys (SatisFacts / Ball State).
            </p>
            <div className="drivers">
              {drivers.map((d) => (
                <div
                  key={d.name}
                  className={`driver ${d.hi === 1 ? "driver--hi" : d.hi === 2 ? "driver--hi2" : ""}`}
                >
                  <div className="driver__name">{d.name}</div>
                  <div className="driver__bar" style={{ width: `${d.w}%` }} />
                </div>
              ))}
            </div>
            <p style={{ marginTop: 22, fontWeight: 700, color: "var(--forest)" }}>
              None of the top five are about price.
            </p>
            <div style={{ marginTop: 10 }}>
              <Plaque>SatisFacts &middot; Ball State University</Plaque>
            </div>
          </Reveal>

          <Reveal
            className="card"
            delay={100}
            style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}
          >
            <div className="bigstat">
              <div className="bigstat__num">
                ≈<em>2&times;</em>
              </div>
              <p className="bigstat__cap">
                Residents with friends in the building are nearly{" "}
                <strong>twice as likely to renew.</strong>
              </p>
              <div style={{ marginTop: 20 }}>
                <Plaque>Apartment Life</Plaque>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal className="inline-cta">
          <CTA to="demo" variant="primary" arrow>
            Turn community into renewals
          </CTA>
        </Reveal>
      </div>
    </section>
  );
}
