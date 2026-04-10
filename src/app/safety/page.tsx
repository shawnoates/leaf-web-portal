import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Safety — Leaf",
  description:
    "Community guidelines and safety practices for hosting and attending plans on Leaf.",
};

export default function SafetyPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-100 py-6 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-sm tracking-[0.3em] uppercase font-light hover:text-zinc-600 transition-colors"
          >
            Leaf
          </Link>
          <Link
            href="/privacy"
            className="text-xs tracking-[0.2em] uppercase text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Privacy
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-20">
        <div className="space-y-3 mb-16">
          <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400">
            Community
          </p>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight">
            Safety & Community Guidelines
          </h1>
          <p className="text-sm text-zinc-500">Last updated: April 10, 2026</p>
        </div>

        <article className="space-y-12 text-zinc-700 leading-relaxed font-light">
          <section className="space-y-4">
            <p>
              Leaf is built to help organizations and communities gather in
              person. The strength of every gathering depends on the trust
              between the people who show up. These guidelines describe what we
              expect from members, hosts, and organization administrators on
              Leaf and Leaf OS, and how we work to keep our community a safe
              and welcoming place.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">
              Our Commitments
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                We design Leaf to support gatherings hosted by trusted
                communities and organizations.
              </li>
              <li>
                We give organization administrators tools to set expectations,
                approve hosts, and manage their members.
              </li>
              <li>
                We respond to safety concerns reported to us and take action
                against users or content that violates these guidelines.
              </li>
              <li>
                We protect your personal information as described in our{" "}
                <Link
                  href="/privacy"
                  className="text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
                >
                  Privacy Policy
                </Link>
                .
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">
              Community Standards
            </h2>
            <p>
              By using Leaflets, you agree to follow these standards. Members
              who violate them may have their content removed, their hosting
              privileges revoked, or their account suspended.
            </p>

            <h3 className="text-base font-normal text-zinc-900 pt-2">
              Be respectful
            </h3>
            <p>
              Treat other members with kindness and respect. Harassment, hate
              speech, threats, bullying, intimidation, and discrimination of any
              kind are not allowed.
            </p>

            <h3 className="text-base font-normal text-zinc-900 pt-2">
              Be honest
            </h3>
            <p>
              Use your real name and an accurate photo. Misrepresenting your
              identity, impersonating another person, or creating fake accounts
              is not allowed.
            </p>

            <h3 className="text-base font-normal text-zinc-900 pt-2">
              Keep gatherings safe and legal
            </h3>
            <p>
              Hosts are responsible for the plans they create. Do not host
              gatherings that promote illegal activity, endanger participants,
              or violate the policies of your organization.
            </p>

            <h3 className="text-base font-normal text-zinc-900 pt-2">
              No exploitation of minors
            </h3>
            <p>
              Content or behavior that sexualizes, endangers, or exploits
              minors is strictly prohibited and will be reported to the
              appropriate authorities.
            </p>

            <h3 className="text-base font-normal text-zinc-900 pt-2">
              No spam or scams
            </h3>
            <p>
              Do not use Leaf to send unsolicited promotional messages, run
              scams, phish for information, or distribute malware.
            </p>

            <h3 className="text-base font-normal text-zinc-900 pt-2">
              Respect privacy
            </h3>
            <p>
              Do not share private information about other members without
              their consent. What happens at a gathering should be treated with
              discretion and respect.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">For Hosts</h2>
            <p>
              Hosting on Leaf is a position of trust. When you host a plan,
              you are responsible for setting expectations and creating a
              welcoming environment.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Provide accurate details about the time, location, and nature
                of your gathering.
              </li>
              <li>
                Choose locations that are safe and appropriate for the size of
                your group.
              </li>
              <li>
                Be available to your attendees and respond to questions in a
                timely manner.
              </li>
              <li>
                Communicate any cancellations or changes as early as possible.
              </li>
              <li>
                Follow your organization&rsquo;s rules and any local laws that
                apply to your gathering.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">For Attendees</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Only RSVP to plans you intend to attend, and let your host know
                if your plans change.
              </li>
              <li>
                Use your best judgment when meeting new people. Share your
                whereabouts with someone you trust if you&rsquo;re attending a
                gathering with people you haven&rsquo;t met before.
              </li>
              <li>
                Treat venues, hosts, and fellow attendees with respect.
              </li>
              <li>
                Report any behavior that makes you feel unsafe or uncomfortable.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">
              For Organizations
            </h2>
            <p>
              Organization administrators are the first line of trust on Leaf.
              We expect administrators to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Set clear expectations for the members and hosts in your
                community.
              </li>
              <li>
                Review host requests carefully and only approve people you
                trust to represent your organization.
              </li>
              <li>
                Address conflicts and concerns within your community in a fair
                and timely way.
              </li>
              <li>
                Contact Leaf if you encounter behavior that requires our
                attention.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">
              Reporting a Problem
            </h2>
            <p>
              If you experience or witness behavior that violates these
              guidelines, or if you feel unsafe, please contact us right away
              at{" "}
              <a
                href="mailto:team@getleaflets.co"
                className="text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
              >
                team@getleaflets.co
              </a>
              . We review every report and will take appropriate action, which
              may include removing content, suspending accounts, or contacting
              local authorities when necessary.
            </p>
            <p>
              In an emergency, always contact your local emergency services
              first.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">Enforcement</h2>
            <p>
              We may remove content, restrict features, or suspend or terminate
              accounts that violate these guidelines or our Terms of Service.
              We may also cooperate with law enforcement when required by law
              or when we believe doing so is necessary to protect our users.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">
              Updates to These Guidelines
            </h2>
            <p>
              We may update these guidelines as Leaflets grows and as we learn
              from our community. We&rsquo;ll post any changes on this page and
              update the &ldquo;Last updated&rdquo; date above.
            </p>
          </section>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-100 py-12 px-6 mt-12">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-xs text-zinc-400">
            © {new Date().getFullYear()} Leaflets. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-zinc-500">
            <Link href="/safety" className="hover:text-zinc-900 transition-colors">
              Safety
            </Link>
            <Link href="/privacy" className="hover:text-zinc-900 transition-colors">
              Privacy
            </Link>
            <a
              href="mailto:team@getleaflets.co"
              className="hover:text-zinc-900 transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
