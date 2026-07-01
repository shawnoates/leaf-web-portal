import { CTA, TrustStrip } from "./ui";
import Reveal from "./Reveal";

export function FinalCta() {
  return (
    <section className="band-forest section">
      <div className="container" style={{ textAlign: "center", maxWidth: 760 }}>
        <Reveal>
          <h2 className="h-xl" style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)" }}>
            Become the spot your neighbors love.
          </h2>
          <p className="lead" style={{ margin: "20px auto 0" }}>
            Reach the residents minutes from your door, turn them into regulars, and let us
            bring the people. Start with a single deal or one event.
          </p>
          <div
            className="cta-row"
            style={{ marginTop: 30, marginInline: "auto" }}
          >
            <CTA to="partner" variant="primary" arrow>
              Become a partner
            </CTA>
            <CTA to="claim" variant="ghost">
              Claim your business for free
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
          <a href="#nearby">The opportunity</a>
          <a href="#offer">What we offer</a>
          <a href="#how">How it works</a>
        </nav>
        <p className="footer__copy">
          Leaf OS connects local businesses with the neighbors next door. &copy;{" "}
          {new Date().getFullYear()} Leaf by One Common LLC.
        </p>
      </div>
    </footer>
  );
}
