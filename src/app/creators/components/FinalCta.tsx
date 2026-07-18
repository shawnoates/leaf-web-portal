import { CTA, TrustStrip } from "./ui";
import { PARTNER_EMAIL, PARTNER_URL } from "./config";
import Reveal from "./Reveal";

export function FinalCta() {
  return (
    <section className="band-forest section">
      <div className="container" style={{ textAlign: "center", maxWidth: 760 }}>
        <Reveal>
          <h2 className="h-xl" style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)" }}>
            Your people are one prompt away.
          </h2>
          <p className="lead" style={{ margin: "20px auto 0" }}>
            Plan the night, film what happens, post it in your voice &mdash; and get paid for
            the video and the post.
          </p>
          <div className="cta-row cta-row--solo" style={{ justifyContent: "center", marginTop: 30 }}>
            <CTA variant="primary" arrow>
              Partner with us
            </CTA>
          </div>
          <p style={{ margin: "16px 0 0", fontSize: "0.95rem" }}>
            <a href={PARTNER_URL} data-cta="partner" style={{ color: "var(--amber)", fontWeight: 600 }}>
              {PARTNER_EMAIL}
            </a>
          </p>
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
          <a href="#how">How it works</a>
          <a href={PARTNER_URL} data-cta="partner">
            Partner with us
          </a>
        </nav>
        <p className="footer__copy">
          Leaf OS builds the social side of better nights. &copy;{" "}
          {new Date().getFullYear()} Leaf by One Common LLC.
        </p>
      </div>
    </footer>
  );
}
