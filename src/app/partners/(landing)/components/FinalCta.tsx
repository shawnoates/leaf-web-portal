import Link from "next/link";
import { CTA, TrustStrip } from "./ui";
import Reveal from "./Reveal";

export function FinalCta() {
  return (
    <section className="section band-forest closing">
      <div className="container">
        <Reveal>
          <h2 className="closing__h">
            Fill your slowest hours
            <em>with neighbors.</em>
          </h2>
          <p className="lead">
            Your first Neighbor Hour is free: no listing fee, no RSVP fees. Claim it in two
            minutes, and nothing is charged today.
          </p>
          <div className="cta-row cta-row--center">
            <CTA to="join" variant="primary" arrow>
              Claim your free Neighbor Hour
            </CTA>
            <CTA to="login" variant="ghost">
              Partner sign in
            </CTA>
          </div>
          <TrustStrip center />
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__in">
        <div className="footer__about">
          <a className="brand" href="#top">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/leaf-logo-black.png" alt="Leaf" className="brand__logo" />
            <span className="brand__os">OS</span>
          </a>
          <p>Leaf OS connects local businesses with the neighbors next door.</p>
        </div>
        <nav className="footer__col">
          <div className="footer__title">For businesses</div>
          <a href="#nearby">The opportunity</a>
          <a href="#how">How it works</a>
          <a href="#offer">What it costs</a>
          <Link href="/partners/login">Partner sign in</Link>
        </nav>
        <nav className="footer__col">
          <div className="footer__title">Leaf</div>
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/organizations">For organizations</Link>
          <Link href="/help">Help</Link>
        </nav>
        <nav className="footer__col">
          <div className="footer__title">Legal</div>
          <Link href="/terms-conditions">Terms</Link>
          <Link href="/privacy-policy">Privacy</Link>
          <Link href="/safety">Safety</Link>
        </nav>
        <p className="footer__copy">
          &copy; {new Date().getFullYear()} Leaf by One Common LLC.
        </p>
      </div>
    </footer>
  );
}
