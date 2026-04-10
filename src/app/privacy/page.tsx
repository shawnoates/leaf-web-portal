import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Leaf",
  description:
    "How Leaf collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
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
            href="/safety"
            className="text-xs tracking-[0.2em] uppercase text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Safety
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-20">
        <div className="space-y-3 mb-16">
          <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400">
            Legal
          </p>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-zinc-500">Last updated: April 10, 2026</p>
        </div>

        <article className="space-y-12 text-zinc-700 leading-relaxed font-light">
          <section className="space-y-4">
            <p>
              This Privacy Policy describes how Leaf (&ldquo;Leaf,&rdquo;
              &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
              collects, uses, and discloses your information when you use the
              Leaf mobile application, the Leaf OS web portal, and related
              services (collectively, the &ldquo;Service&rdquo;). By using the
              Service, you agree to the collection and use of information in
              accordance with this policy.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">
              1. Information We Collect
            </h2>
            <p>
              We collect several types of information to provide and improve
              the Service:
            </p>
            <h3 className="text-base font-normal text-zinc-900 pt-2">
              Personal Data
            </h3>
            <p>
              While using our Service, we may ask you to provide certain
              personally identifiable information, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Email address</li>
              <li>First and last name</li>
              <li>Phone number</li>
              <li>Profile photo</li>
              <li>Organization or community affiliation</li>
              <li>Usage data</li>
            </ul>

            <h3 className="text-base font-normal text-zinc-900 pt-2">
              Usage Data
            </h3>
            <p>
              Usage Data is collected automatically when using the Service. It
              may include your device&rsquo;s IP address, browser type, browser
              version, pages visited, time and date of visit, time spent on
              pages, unique device identifiers, and other diagnostic data.
            </p>

            <h3 className="text-base font-normal text-zinc-900 pt-2">
              Information from Device Permissions
            </h3>
            <p>
              With your permission, we may collect information from your
              device, including location data, camera and photo library, and
              contact list. You can enable or disable these permissions at any
              time through your device settings.
            </p>

            <h3 className="text-base font-normal text-zinc-900 pt-2">
              Third-Party Sign-In
            </h3>
            <p>
              You can create an account using third-party sign-in services such
              as Apple, Google, or Facebook. If you choose to do so, we may
              receive information already associated with that account, such as
              your name and email address.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">
              2. How We Use Your Information
            </h2>
            <p>Leaf uses your personal data for the following purposes:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide, maintain, and improve the Service</li>
              <li>To create and manage your account</li>
              <li>
                To enable features such as RSVPs, hosting plans, and
                participating in communities and organizations
              </li>
              <li>To send you transactional and service-related notifications</li>
              <li>
                To send you marketing or promotional communications, where
                permitted (you may opt out at any time)
              </li>
              <li>To respond to your inquiries and support requests</li>
              <li>To detect, prevent, and address technical or safety issues</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">
              3. How We Share Your Information
            </h2>
            <p>We may share your information in the following situations:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="font-medium text-zinc-900">
                  With other users:
                </strong>{" "}
                When you participate in public areas of the Service (such as
                hosting or attending a plan), certain profile information and
                activity may be visible to other members of your organization.
              </li>
              <li>
                <strong className="font-medium text-zinc-900">
                  With service providers:
                </strong>{" "}
                We share information with vendors who perform services on our
                behalf, such as hosting, analytics, customer support, and email
                delivery.
              </li>
              <li>
                <strong className="font-medium text-zinc-900">
                  With organization administrators:
                </strong>{" "}
                If you join an organization on Leaf, the administrators of that
                organization may have access to certain information about your
                participation.
              </li>
              <li>
                <strong className="font-medium text-zinc-900">
                  For business transfers:
                </strong>{" "}
                In connection with a merger, sale of company assets, financing,
                or acquisition.
              </li>
              <li>
                <strong className="font-medium text-zinc-900">
                  For legal reasons:
                </strong>{" "}
                When required to comply with the law, valid legal process, or
                to protect the rights, property, or safety of Leaf, our users,
                or others.
              </li>
              <li>
                <strong className="font-medium text-zinc-900">
                  With your consent:
                </strong>{" "}
                For any other purpose disclosed to you when we collect the
                information.
              </li>
            </ul>
            <p>
              We do not sell your personal information to third parties for
              monetary consideration.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">
              4. Data Retention
            </h2>
            <p>
              We retain your personal data only for as long as is necessary for
              the purposes set out in this Privacy Policy, to comply with our
              legal obligations, resolve disputes, and enforce our agreements.
              Usage Data is generally retained for a shorter period, except
              when used to strengthen security or improve functionality.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">5. Security</h2>
            <p>
              The security of your personal data is important to us. We use
              commercially acceptable means to protect your information, but no
              method of transmission over the Internet or method of electronic
              storage is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">
              6. Your Rights
            </h2>
            <p>
              Depending on where you live, you may have certain rights
              regarding your personal data, including the right to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your personal data</li>
              <li>Object to or restrict our processing of your data</li>
              <li>Request a portable copy of your data</li>
              <li>Withdraw consent at any time, where applicable</li>
            </ul>
            <p>
              To exercise any of these rights, please contact us at{" "}
              <a
                href="mailto:team@getleaflets.co"
                className="text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
              >
                team@getleaflets.co
              </a>
              .
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">
              7. Children&rsquo;s Privacy
            </h2>
            <p>
              The Service is not directed to anyone under the age of 13. We do
              not knowingly collect personally identifiable information from
              anyone under the age of 13. If you are a parent or guardian and
              you are aware that your child has provided us with personal data,
              please contact us so we can take appropriate action.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">
              8. Third-Party Services
            </h2>
            <p>
              The Service may contain links to or integrations with
              third-party websites and services that are not operated by us. We
              are not responsible for the content, privacy policies, or
              practices of any third-party sites or services. We strongly
              advise you to review the privacy policy of every site you visit.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">
              9. Changes to This Privacy Policy
            </h2>
            <p>
              We may update our Privacy Policy from time to time. We will
              notify you of any changes by posting the new Privacy Policy on
              this page and updating the &ldquo;Last updated&rdquo; date above.
              Changes are effective when they are posted on this page.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-normal text-zinc-900">10. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please
              contact us at{" "}
              <a
                href="mailto:team@getleaflets.co"
                className="text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
              >
                team@getleaflets.co
              </a>
              .
            </p>
          </section>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-100 py-12 px-6 mt-12">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-xs text-zinc-400">
            © {new Date().getFullYear()} Leaf. All rights reserved.
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
