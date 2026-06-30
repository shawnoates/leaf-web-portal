import { CTA, TrustStrip } from "./ui";
import Reveal from "./Reveal";

export function FinalCta() {
  return (
    <section className="band-forest section">
      <div className="container" style={{ textAlign: "center", maxWidth: 760 }}>
        <Reveal>
          <h2 className="h-xl" style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)" }}>
            Give your residents a reason to stay.
          </h2>
          <p className="lead" style={{ margin: "20px auto 0" }}>
            Build community, keep residents longer, and protect your NOI &mdash; without adding
            a thing to your team&rsquo;s plate.
          </p>
          <div className="cta-row" style={{ justifyContent: "center", marginTop: 30 }}>
            <CTA to="demo" variant="primary" arrow>
              Book a Concierge demo
            </CTA>
            <CTA to="free" variant="ghost">
              Start your calendar free
            </CTA>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <TrustStrip />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__in">
        <a className="brand brand--light" href="#top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/leaf-logo-white.svg" alt="Leaf" className="brand__logo" />
          <span className="brand__os brand__os--light">OS</span>
        </a>
        <nav className="footer__links">
          <a href="#why">Why community</a>
          <a href="#how">How it works</a>
          <a href="#cost">The math</a>
        </nav>
        <p className="footer__copy">
          Leaf builds the social side of better buildings. &copy; {new Date().getFullYear()}{" "}
          Leaf by One Common LLC.
        </p>
      </div>
    </footer>
  );
}
