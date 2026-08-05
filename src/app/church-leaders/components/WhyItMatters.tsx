import Reveal from "../../resident-managers/components/Reveal";
import { Eyebrow, Plaque } from "./ui";

/**
 * One idea, one stat. A long research argument implies a big
 * commitment, and this page is asking for a four-minute one. Resist
 * adding a second figure here.
 */
export default function WhyItMatters() {
  return (
    <section className="band-white section">
      <div className="container why">
        <Reveal className="section-head" style={{ marginBottom: 28 }}>
          <Eyebrow>Why it matters</Eyebrow>
          <h2 className="h-lg">Friendships don&rsquo;t start in rows.</h2>
          <p className="lead">
            People sit near each other for a year and never learn a name. The things
            that actually turn attenders into friends are small, unofficial, and
            mid&#8209;week &mdash; and they&rsquo;re the exact things no church calendar
            has ever had a place for.
          </p>
        </Reveal>

        <Reveal className="stat-card" delay={90}>
          <div className="stat-card__fig stat-fig">72% vs 51%</div>
          <p className="stat-card__body">
            Members whose closest friend attends their church show up weekly. For those
            whose closest friend is elsewhere: 51%.
          </p>
          <Plaque>Gallup</Plaque>
        </Reveal>

        <Reveal>
          <p className="under-line">
            You can&rsquo;t program friendship. You can make it easier to find.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
