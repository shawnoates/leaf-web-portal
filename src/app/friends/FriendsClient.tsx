"use client";

/**
 * /friends — Friend Mode, explained in one scroll.
 *
 * Not built on MarketingPage: that page is shaped around "type a vibe, get a
 * calendar" (prompt hero, calendar grid, sticky generate bar), and none of
 * that is the ask here. This one has a single job: get a calendar owner to
 * turn Friend Mode on from their calendar in the dashboard.
 */

import Link from "next/link";
import { useEffect } from "react";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useIsLoggedIn } from "@/components/marketing/useMarketingSession";
import { trackMarketingEvent } from "@/components/marketing/analytics";
import { FriendModeIcon } from "@/components/crew/FriendModeGlyphs";

const STEPS = [
  { n: "01", title: "Turn it on", body: "Flip the Friend Mode switch on a calendar you own (up to 15 people), then invite your followers or share the invite link." },
  { n: "02", title: "Leaf picks a night", body: "Every few weeks Leaf picks a place from your crew's book and asks everyone which dates work, by text or in the app." },
  { n: "03", title: "It locks itself", body: "The night most people can make gets locked. Whoever's booking gets the link. Everyone gets a reminder the day of." },
  { n: "04", title: "It learns", body: "Thumbs up or down the morning after. Leaf remembers what the crew liked and which nights never work." },
];


const FAQ = [
  { q: "Do my friends need the app?", a: "No. Everything works on the web from their personal link. App users get notifications, and anyone can choose to get texts instead." },
  { q: "Will Leaf spam my friends?", a: "No. Leaf only texts people who choose to get texts about the crew (it's never switched on for them), at most 5 a week, and anyone can reply STOP at any time." },
  { q: "What if nobody can make it?", a: "Leaf tries the backup place and two new dates once. If that misses too, it skips this round and comes back on the next rhythm." },
  { q: "Who books the table?", a: "Whoever started that night, or the person who started the crew. Leaf sends them a booking link and tells everyone once they reply BOOKED." },
  { q: "How much does it cost?", a: "Nothing. Friend Mode is free for friends." },
  { q: "Can anyone in the crew start a plan?", a: "Yes. Text PLAN or tap \"Plan something\" and Leaf finds a night. Or propose your own place and dates and Leaf runs the count." },
];

export default function FriendsClient() {
  const isLoggedIn = useIsLoggedIn();
  useEffect(() => { trackMarketingEvent("friend_mode_cta_view", { surface: "friends_page" }); }, []);
  const cta = "/dashboard";
  const onCta = () => trackMarketingEvent("friend_mode_cta_click", { surface: "friends_page" });

  return (
    <div className="mkt min-h-screen">
      {/* The site nav stays light; everything below it is the dark Friend Mode palette. */}
      <MarketingNav isLoggedIn={isLoggedIn} />
      <div className="fm">

      <section className="mx-auto max-w-3xl px-5 pb-16 pt-14 text-center">
        <div className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wide text-leaf-600"><FriendModeIcon size={24} /> Friend Mode</div>
        <div className="mt-6 flex justify-center"><FriendModeIcon size={96} title="Friend Mode" /></div>
        <h1 className="mt-3 text-4xl font-semibold leading-tight text-leaf-900 sm:text-5xl">
          Your friends, actually seeing each other.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-700">
          Leaf finds a night that works for everyone and plans it. You add the people; nobody has to be the planner.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={cta} onClick={onCta} className="rounded-full bg-leaf-800 px-6 py-3 text-[15px] font-medium text-white hover:bg-leaf-700">
            Turn it on for your calendar
          </Link>
          <span className="text-sm text-zinc-500">Free. Friends don&rsquo;t need the app.</span>
        </div>
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm">
          <div className="text-xs text-zinc-500">A text from Leaf</div>
          <p className="mt-1 text-[15px] leading-relaxed text-leaf-900">
            Thursday crew: next night at Sal&rsquo;s (from Jess&rsquo;s list). Which work? 1) Thu 10/9 2) Sat 10/11 3) Tue 10/14, 7pm. Reply with numbers (like 1 3) or OUT.
          </p>
          <p className="mt-2 text-right text-[15px] text-leaf-700">1 3</p>
        </div>
      </section>

      <section className="border-t border-zinc-100 bg-leaf-50/40 py-14">
        <div className="mx-auto max-w-4xl px-5">
          <h2 className="text-2xl font-semibold text-leaf-900">How it works</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-2">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-2xl border border-zinc-200 bg-white p-5">
                <div className="text-xs font-medium text-leaf-600">{s.n}</div>
                <h3 className="mt-1 text-lg font-semibold text-leaf-900">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-zinc-700">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto max-w-4xl px-5">
          <h2 className="text-2xl font-semibold text-leaf-900">Met someone at a Leaf plan?</h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-zinc-700">
            Friend Mode is how a neighborhood calendar turns into a friend group. Anyone you&rsquo;ve been to a plan with can be added to your crew in a tap. They see your name, never your number, and only join if they say so.
          </p>
        </div>
      </section>

      <section id="texts" className="border-t border-zinc-100 py-14">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-2xl font-semibold text-leaf-900">Texts are up to you</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-zinc-700">
            Friend Mode works in the Leaf app and on the web. If you&rsquo;d rather get date polls and the night&rsquo;s details by
            text, check &ldquo;Text me about this crew&rsquo;s plans&rdquo; when you join. It&rsquo;s never checked for you, and you can turn it off
            any time on your crew page or by replying STOP.{" "}
            <Link href="/friends/sms-consent" className="underline">How text consent works</Link>
          </p>
        </div>
      </section>

      <section className="border-t border-zinc-100 py-14">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-2xl font-semibold text-leaf-900">Questions</h2>
          <dl className="mt-6 divide-y divide-zinc-100">
            {FAQ.map((f) => (
              <div key={f.q} className="py-4">
                <dt className="text-[15px] font-medium text-leaf-900">{f.q}</dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-zinc-700">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="py-14 text-center" style={{ background: "#253A33", color: "#F2F1EC" }}>
        <h2 className="text-2xl font-semibold">Invite your people. Leaf does the rest.</h2>
        <Link href={cta} onClick={onCta} className="mt-6 inline-block rounded-full px-6 py-3 text-[15px] font-medium" style={{ background: "#F2F1EC", color: "#253A33" }}>
          Turn it on for your calendar
        </Link>
      </section>

      <MarketingFooter blurb="Leaf finds the night. You show up." />
      </div>
    </div>
  );
}
