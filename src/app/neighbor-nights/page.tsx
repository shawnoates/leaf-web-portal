import type { Metadata, Viewport } from "next";
import { Brand, Shell } from "@/app/o/m/[token]/ui";

/**
 * /neighbor-nights — what a business owner reads before claiming their free
 * night: how a Leaf night works, what it costs, and the usual questions. The
 * rep's walk-in email links here; ?lead= carries the rep's lead on to
 * /partner so the sign-up still credits the rep.
 */

export const metadata: Metadata = {
  title: "Neighbors on your slowest nights | Leaf",
  description:
    "Tell us your slowest days and hours and we'll send local residents your way. Your first night is free: no listing fee, no RSVP fees.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f2ea",
};

const card =
  "rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(28,25,23,0.06),0_8px_24px_-12px_rgba(28,25,23,0.12)]";
const eyebrow = "text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-600";
const h2 = "mt-1 font-fm-serif text-[28px] leading-[1.05] text-stone-900";

const STEPS = [
  ["Tell us your slowest days and hours.", "The nights you'd most like to fill."],
  [
    "We put the night on your neighborhood's Leaf calendar.",
    "Local residents who follow the calendar see it and RSVP. A typical night is 8 to 15 neighbors.",
  ],
  ["Neighbors come in and order their own.", "Entry is free for them. You just need room for the group."],
  ["We count RSVPs 2 hours before.", "Never more than you can seat. You're charged after the night."],
];

const PRICES = [
  ["First night", "Free. No listing fee, no RSVP fees. Add a card to claim it."],
  ["After that", "$6 for each person who RSVPs, charged after the night."],
  ["A quiet night", "Under 5 RSVPs costs nothing, and we set up another night for you."],
  ["Leaf balance", "From your second night, nights come out of a prepaid balance. We add $60 when it drops under $18. You can switch that off."],
  ["Contract", "None. Stop anytime."],
];

const FAQ = [
  [
    "What's the catch?",
    "There isn't one. The card holds your free night, and nothing is charged for it. If you like how it goes, keep booking nights at $6 per RSVP.",
  ],
  [
    "Who are these people?",
    "Residents of the buildings around you who use their neighborhood's Leaf calendar to plan their week. They live a short walk away, so they can become regulars.",
  ],
  [
    "Do I have to run anything?",
    "No. Give the group a few tables or a corner of the room. They order off your menu like anyone else.",
  ],
  [
    "How is this different from an ad?",
    "You pay for people who actually said they're coming, not for views or clicks. A quiet night costs nothing.",
  ],
  ["How long is the free night held?", "For 7 days after you first open your link."],
];

export default async function NeighborNightsPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string | string[] }>;
}) {
  const { lead } = await searchParams;
  const token = typeof lead === "string" ? lead : null;
  const claimHref = token ? `/partner?lead=${encodeURIComponent(token)}` : "/partner";

  return (
    <Shell>
      <Brand />

      <header className="mt-8 px-1">
        <p className={eyebrow}>For local businesses</p>
        <h1 className="mt-2 font-fm-serif text-[40px] leading-[1.02] tracking-[-0.01em] text-stone-900">
          Neighbors on your <em className="text-leaf-700">slowest nights</em>.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-stone-600">
          Tell us your slowest days and hours and we&rsquo;ll send local residents your way then. Your first night is free.
        </p>
      </header>

      <div className="mt-7 space-y-4">
        <section className="rounded-3xl bg-leaf-800 p-5 text-white">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-200">Your first night</p>
          <p className="mt-1 font-fm-serif text-[32px] leading-[1.05]">Free.</p>
          <p className="mt-2 text-[16px] leading-relaxed text-leaf-100">
            No listing fee and no RSVP fees. Add a card to claim it. Nothing is charged for that night.
          </p>
        </section>

        <section className={card}>
          <p className={eyebrow}>How it works</p>
          <h2 className={h2}>Four steps</h2>
          <ol className="mt-4 space-y-4">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-leaf-100 text-[14px] font-semibold text-leaf-800">
                  {i + 1}
                </span>
                <div>
                  <p className="text-[16px] font-semibold text-stone-900">{title}</p>
                  <p className="mt-0.5 text-[15px] leading-relaxed text-stone-600">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={card}>
          <p className={eyebrow}>Pricing</p>
          <h2 className={h2}>What it costs</h2>
          <dl className="mt-4 divide-y divide-stone-100">
            {PRICES.map(([label, body]) => (
              <div key={label} className="py-3">
                <dt className="text-[15px] font-semibold text-stone-900">{label}</dt>
                <dd className="mt-0.5 text-[15px] leading-relaxed text-stone-600">{body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={card}>
          <p className={eyebrow}>Also included</p>
          <h2 className={h2}>A counter card</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
            A card for your counter with a QR code, so your own regulars can find your Leaf nights too.
          </p>
        </section>

        <section className={card}>
          <p className={eyebrow}>Questions</p>
          <h2 className={h2}>What owners ask</h2>
          <div className="mt-4 divide-y divide-stone-100">
            {FAQ.map(([q, a]) => (
              <div key={q} className="py-3">
                <p className="text-[16px] font-semibold text-stone-900">{q}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-stone-600">{a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200/80 bg-[#f6f2ea]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <a
            href={claimHref}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-leaf-800 text-[17px] font-semibold text-white shadow-sm"
          >
            Claim your free night
          </a>
          <p className="mt-2 text-center text-[12px] text-stone-500">Takes two minutes. Nothing is charged today.</p>
        </div>
      </div>
    </Shell>
  );
}
