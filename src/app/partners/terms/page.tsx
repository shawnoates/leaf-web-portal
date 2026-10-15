import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { MERCHANT_TERMS_VERSION } from "@/lib/merchant-terms";

export const metadata: Metadata = {
  title: "Merchant Terms | Leaf for businesses",
  description: "The terms for businesses that host Neighbor Hours, Neighbor Nights and taster classes with Leaf, and post deals.",
};

/**
 * The Leaf Merchant Terms every business agrees to at sign-up (a required
 * checkbox; the version and time are recorded on their offer). Bump
 * MERCHANT_TERMS_VERSION (src/lib/merchant-terms.ts and the server's
 * offer-merchant-terms.js) when this changes in substance: signed-up
 * merchants are asked to agree again on their dashboard.
 */
function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-normal text-zinc-900">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}

const li = "list-disc pl-6 space-y-2";

export default function MerchantTermsPage() {
  const updated = new Date(`${MERCHANT_TERMS_VERSION}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="border-b border-zinc-100 px-6 py-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/partners" className="text-sm font-light uppercase tracking-wider transition-colors hover:text-zinc-600">
            Leaf for businesses
          </Link>
          <Link href="/privacy-policy" className="text-xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-900">
            Privacy
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-12 space-y-3">
          <p className="text-xs uppercase tracking-wider text-zinc-400">Legal</p>
          <h1 className="text-4xl font-light tracking-tight md:text-5xl">Merchant Terms</h1>
          <p className="text-sm text-zinc-500">Last updated: {updated}</p>
        </div>

        <article className="space-y-10 font-light leading-relaxed text-zinc-700">
          <section className="space-y-3">
            <p>
              These terms are between your business (&ldquo;you&rdquo;) and One Common LLC, doing business as Leaf
              (&ldquo;Leaf&rdquo;, &ldquo;we&rdquo;). They cover hosting Neighbor Hours, Neighbor Nights and taster
              classes that Leaf lists on its neighborhood calendars, and posting deals. You agree to them when you sign up
              on your Leaf page, and they apply alongside the{" "}
              <Link href="/terms-conditions" className="underline hover:text-zinc-900">
                Leaf Terms and Conditions
              </Link>{" "}
              and{" "}
              <Link href="/privacy-policy" className="underline hover:text-zinc-900">
                Privacy Policy
              </Link>
              . Where they differ, these terms win for your business.
            </p>
            <p>The person who signs up confirms they can agree for the business.</p>
          </section>

          <Section n={1} title="What Leaf does">
            <p>
              Leaf runs community calendars that residents follow to make plans in their neighborhood. We list nights at
              your business on the calendar for your area, invite the residents who follow it, take RSVPs and, for
              ticketed nights, sell the tickets. We write each night&rsquo;s listing from what you tell us; you can ask
              for a change at any time from your dashboard. We decide which calendar a night appears on and when it is
              posted.
            </p>
          </Section>

          <Section n={2} title="Neighbor Hours (bars, restaurants and cafés)">
            <ul className={li}>
              <li>
                <strong className="font-medium text-zinc-900">Your first Neighbor Hour is free</strong>: no listing fee
                and no RSVP fees, however many neighbors come.
              </li>
              <li>
                <strong className="font-medium text-zinc-900">After that, you pay a fee for each RSVP</strong>, $6
                unless your page shows a different rate. It applies to the Neighbor Hours Leaf posts at your place and to
                plans neighbors make at your place on the days and times you pick. RSVPs are counted 2 hours before each
                night starts and never above the number of guests you said you can seat. RSVPs outside your days and times
                are free.
              </li>
              <li>
                <strong className="font-medium text-zinc-900">Your weekly limit</strong> caps your RSVP fees in any week
                (Monday to Sunday). You set it and can change it, or switch Neighbor Hours off, anytime from your dashboard.
              </li>
              <li>
                <strong className="font-medium text-zinc-900">A one-time $100 setup fee</strong> is added to your first
                paid week. It is waived for good if fewer than 5 neighbors RSVP to your free first Neighbor Hour.
              </li>
              <li>
                <strong className="font-medium text-zinc-900">You authorize Leaf to charge the card you save</strong> for
                these fees, after each night or once a week for the week before, without asking each time. If a charge
                fails we may retry it and ask you to update your card. Any balance you hold with Leaf is
                used first.
              </li>
            </ul>
          </Section>

          <Section n={3} title="Ticketed nights (shops and studios)">
            <ul className={li}>
              <li>
                <strong className="font-medium text-zinc-900">Leaf sells the tickets.</strong> Guests pay Leaf the ticket
                price plus a booking fee, which is Leaf&rsquo;s. Leaf handles payment, refunds and receipts.
              </li>
              <li>
                <strong className="font-medium text-zinc-900">Your first ticketed night has no Leaf fee</strong>: you
                receive the full ticket price of every ticket sold.
              </li>
              <li>
                <strong className="font-medium text-zinc-900">After that, Leaf keeps a fee for each ticket sold</strong>,
                $6 unless your page shows a different rate, never more than the ticket price. Card processing fees are
                Leaf&rsquo;s.
              </li>
              <li>
                <strong className="font-medium text-zinc-900">We pay you the rest</strong> through Stripe to the bank
                account you connect, usually the morning after the night. You must connect payouts before a ticketed night
                can be posted, and you agree to Stripe&rsquo;s connected account terms when you do.
              </li>
              <li>
                <strong className="font-medium text-zinc-900">Shops (a Neighbor Night):</strong> each ticket is $20 and is
                $20 of store credit to spend at your shop during that night. You agree to honor it at your regular prices
                for any guest who shows their Leaf ticket. The credit has no cash value, can&rsquo;t be split across days,
                and ends when the night ends. You also give guests the extra you told us about (for example a drink or a
                first look).
              </li>
              <li>
                <strong className="font-medium text-zinc-900">Studios (a taster):</strong> you set the ticket price and
                run the class as described in the listing.
              </li>
            </ul>
          </Section>

          <Section n={4} title="Refunds for guests">
            <ul className={li}>
              <li>A guest who cancels 48 hours or more before a ticketed night gets the ticket price back; the booking fee is not refunded.</li>
              <li>Inside 48 hours there is no refund, and the ticket counts toward your payout.</li>
              <li>If the night is cancelled, by you or by Leaf, every guest gets a full refund and there is no payout for that night.</li>
            </ul>
          </Section>

          <Section n={5} title="Leaf hosts">
            <p>
              You can ask for a Leaf host to welcome the group and run a night. The fee is $99 for each night a Leaf host
              runs at your request, and only when at least one neighbor RSVP&rsquo;d. For Neighbor Hours it is added to
              that night&rsquo;s bill; for ticketed nights it comes out of that night&rsquo;s payout. If we can&rsquo;t
              find a host, you host the night and there is no fee. A host Leaf sends on its own initiative is at no cost to
              you.
            </p>
          </Section>

          <Section n={6} title="Deals">
            <p>
              You can post one deal at a time on your neighborhood&rsquo;s calendar for $20 a month, charged to your card
              once Leaf approves it and each month after while it runs. You must honor the deal as posted. Stop it anytime
              from your dashboard.
            </p>
          </Section>

          <Section n={7} title="Your responsibilities">
            <ul className={li}>
              <li>Give the group the space, time and welcome described in your listing, and keep your details on your dashboard accurate.</li>
              <li>
                Run your business lawfully, including licenses, food safety, occupancy limits and any alcohol you serve
                (checking ID and serving responsibly). You are responsible for your premises, staff and what you sell.
              </li>
              <li>Keep the insurance a business like yours normally carries.</li>
              <li>Treat every guest the same and don&rsquo;t turn anyone away for a discriminatory reason.</li>
              <li>Pay your own taxes on what you earn, including on ticket payouts.</li>
            </ul>
          </Section>

          <Section n={8} title="Changing or cancelling a night">
            <p>
              If you can&rsquo;t host a night, tell us as soon as you can, and at least 48 hours before it starts. We will
              tell the guests and refund any tickets. Repeated late cancellations may mean we stop listing your nights. Leaf
              may move or cancel a night for safety, weather or too few RSVPs, and will tell you when we do.
            </p>
          </Section>

          <Section n={9} title="Your name, photos and listings">
            <p>
              You let Leaf use your business name, logo, address, photos (including those on your Google listing) and the
              listing we write with you, to promote your nights and deals on Leaf and in Leaf&rsquo;s marketing. Photos taken
              at a night by a Leaf host may be shared with you and used by Leaf, only with the consent of the people shown.
              You can ask us to stop using any of it at any time.
            </p>
          </Section>

          <Section n={10} title="Guests and their information">
            <p>
              Guests are Leaf members. We share what you need to run a night, such as how many are coming, and never sell
              their information. Use anything you learn about guests only to host the night, not for marketing unless they
              agree to hear from you directly. Leaf isn&rsquo;t responsible for how guests behave, though we will act on
              any problem you report.
            </p>
          </Section>

          <Section n={11} title="Messages from Leaf">
            <p>
              We email you, and text you if you opt in, about your nights, RSVPs, charges and payouts. You choose which
              messages you get on your dashboard; some, like receipts and changes to these terms, always go by email.
            </p>
          </Section>

          <Section n={12} title="Ending">
            <p>
              There is no contract term: you can stop anytime by switching off Neighbor Hours on your dashboard or emailing{" "}
              <a href="mailto:partners@joinleaf.com" className="underline hover:text-zinc-900">
                partners@joinleaf.com
              </a>
              . Leaf can stop listing your nights at any time, with notice where we can give it. Fees for nights that
              already ran stay due, and payouts already owed are still paid. Sections 3 (store credit for a night that
              ran), 4, 7, 10 and 13 continue after you stop.
            </p>
          </Section>

          <Section n={13} title="Liability">
            <p>
              Leaf provides the calendar and listings as they are, and doesn&rsquo;t guarantee any number of RSVPs, guests
              or sales. To the extent the law allows, Leaf is not liable for indirect or consequential losses, such as lost
              profits, and Leaf&rsquo;s total liability to you is limited to the fees you paid Leaf in the three months
              before the claim. You are responsible for claims that arise from your premises, staff, products or services,
              and you will cover Leaf&rsquo;s reasonable costs if a guest or anyone else brings such a claim against Leaf.
            </p>
          </Section>

          <Section n={14} title="Changes to these terms">
            <p>
              We may update these terms. We will email you at least 14 days before a change to fees or anything else that
              matters, and ask you to agree to the new version on your dashboard. If you don&rsquo;t agree, you can stop as
              described above.
            </p>
          </Section>

          <Section n={15} title="General">
            <p>
              These terms are governed by the laws of the State of New York, and any dispute goes to the state or federal
              courts in New York County. If part of these terms can&rsquo;t be enforced, the rest still applies. Questions:{" "}
              <a href="mailto:partners@joinleaf.com" className="underline hover:text-zinc-900">
                partners@joinleaf.com
              </a>
              .
            </p>
            <p className="text-sm text-zinc-500">Version {MERCHANT_TERMS_VERSION}</p>
          </Section>
        </article>
      </main>
    </div>
  );
}
