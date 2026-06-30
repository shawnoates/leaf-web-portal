import { Eyebrow, Plaque } from "./ui";
import Reveal from "./Reveal";

const proof = [
  {
    fig: "#1",
    line: "Sense of community has been the top renewal driver since 2013.",
    src: "SatisFacts / Ball State",
  },
  {
    fig: "≈ 2×",
    line: "Friendships in the building nearly double a resident's likelihood to renew.",
    src: "Apartment Life",
  },
  {
    fig: "Top 5",
    line: "Community events rank among the top five drivers of renewals.",
    src: "SatisFacts",
  },
  {
    fig: "≈ $4,000",
    line: "The cost of a single resident move-out.",
    src: "Zego / industry benchmarks",
  },
  {
    fig: "39.6%",
    line:
      "of renters use referrals from friends in their apartment search — community feeds leasing too.",
    src: "SatisFacts 2025",
  },
  {
    fig: "NOI",
    line:
      "The highest-NOI communities are the ones that invest in resident experience.",
    src: "ZRS Management",
  },
];

export default function Proof() {
  return (
    <section className="band-mint section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>The evidence</Eyebrow>
          <h2 className="h-lg">Don&rsquo;t take our word for it.</h2>
          <p className="lead">
            The link between community and retention is one of the most consistent findings in
            multifamily research.
          </p>
        </Reveal>

        <div className="proof-grid">
          {proof.map((p, i) => (
            <Reveal className="card" key={p.fig + i} delay={(i % 3) * 90}>
              <div className="proof__fig stat-fig">{p.fig}</div>
              <p className="proof__line">{p.line}</p>
              <Plaque>{p.src}</Plaque>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
