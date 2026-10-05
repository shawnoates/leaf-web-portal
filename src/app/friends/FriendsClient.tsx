"use client";

/**
 * /friends: Friend Mode's landing page. One job: start a crew right here.
 *
 * The form (StartCrewForm) sits in the hero: name the crew, pick how often,
 * verify a phone, and the crew exists with an invite link to send. Below it,
 * how a night comes together, the Crew Pulse card on a sample crew, and the
 * questions people ask. Calendar owners can still switch Friend Mode on from
 * their dashboard; that's a line in the FAQ, not the main ask.
 *
 * Not built on MarketingPage: that page is shaped around "type a vibe, get a
 * calendar", and none of that is the ask here.
 */

import Link from "next/link";
import { useEffect } from "react";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useIsLoggedIn } from "@/components/marketing/useMarketingSession";
import { trackMarketingEvent } from "@/components/marketing/analytics";
import { FriendModeIcon } from "@/components/crew/FriendModeGlyphs";
import StartCrewForm from "@/components/crew/StartCrewForm";
import CrewPulseCard from "@/components/crew/CrewPulseCard";
import { SAMPLE_PULSE } from "@/lib/crew-pulse";

const STEPS = [
  { n: "01", title: "Start a crew", photo: "/photo-row/kitchen-dinner.jpg", body: "Name it, pick how often, and send the link to the group chat. Friends join from the link, no app needed." },
  { n: "02", title: "Leaf finds a night", photo: "/photo-row/trail-hike.jpg", body: "Leaf picks a place from your crew's book and a few dates that fit everyone's calendars, then asks who can make which." },
  { n: "03", title: "It plans itself", photo: "/photo-row/restaurant-dinner.jpg", body: "The date most people can make gets locked and invites go out. The organizer gets a link to book. Everyone gets a reminder that day." },
  { n: "04", title: "It keeps going", photo: "/photo-row/backyard-lunch.jpg", body: "On your rhythm, the next round starts on its own. Leaf remembers what the crew liked and which nights never work." },
];

/** The fanned row under the hero: real-looking crews, each captioned like one on Leaf. */
const CREWS = [
  { photo: "/photo-row/bar-night.jpg", name: "Thursday drinks", pace: "Every week" },
  { photo: "/photo-row/pickup-soccer.jpg", name: "Sunday pickup", pace: "Every week" },
  { photo: "/photo-row/kitchen-dinner.jpg", name: "Supper club", pace: "Every month" },
  { photo: "/photo-row/trail-hike.jpg", name: "Trail crew", pace: "Every 2 weeks" },
  { photo: "/photo-row/restaurant-dinner.jpg", name: "Old roommates", pace: "Every month" },
  { photo: "/photo-row/bike-ride.jpg", name: "River ride", pace: "Every 2 weeks" },
  { photo: "/photo-row/skatepark.jpg", name: "Skate Saturdays", pace: "Every week" },
];
const FAN = [-6, 3, -2, 5, -4, 2, -3];

const FAQ = [
  { q: "Do my friends need the app?", a: "No. Everything works on the web from their own link. App users get notifications, and anyone can choose to get texts instead." },
  { q: "Will Leaf spam my friends?", a: "No. Leaf only texts people who choose texts about the crew, at most 5 a week, and anyone can reply STOP at any time." },
  { q: "What if nobody can make it?", a: "Leaf tries a backup place and new dates once. If that misses too, it skips this round and comes back on the next one." },
  { q: "Who books the table?", a: "Whoever's hosting that night, or the person who started the crew. Leaf sends them a booking link and tells everyone once it's booked." },
  { q: "What's Crew Pulse?", a: "A fitness tracker for your friend group. Three rings: do people show up, does the crew keep its rhythm, and is more than one person doing the work. It appears on your crew page after the first night." },
  { q: "I already run a calendar on Leaf. Can I use it?", a: "Yes. Switch Friend Mode on for your calendar from your dashboard (Friends and Community calendars with up to 15 people)." },
  { q: "How much does it cost?", a: "Nothing. Friend Mode is free." },
];

export default function FriendsClient() {
  const isLoggedIn = useIsLoggedIn();
  useEffect(() => { trackMarketingEvent("friend_mode_cta_view", { surface: "friends_page" }); }, []);

  return (
    <div className="mkt min-h-screen">
      <div className="fm font-fm-sans">
        <FriendModeNav isLoggedIn={isLoggedIn} />
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16 lg:pb-24 lg:pt-20">
          <div className="flex flex-col gap-6">
            <FriendModeIcon size={40} title="Friend Mode" />
            <h1 className="m-0 font-fm-serif text-[52px] font-normal leading-[0.98] tracking-[-0.01em] sm:text-[72px] lg:text-[84px]">
              Your friends, <span className="italic text-fm-accent">actually</span> seeing each other.
            </h1>
            <p className="m-0 max-w-xl text-lg leading-relaxed text-fm-ink-2">
              Leaf picks a night that works around everyone&rsquo;s calendars, picks the place, and asks who&rsquo;s in. Nobody has to be the planner.
            </p>
            <div className="max-w-md rounded-2xl border border-fm-line-dim bg-fm-surface p-4">
              <div className="text-xs text-fm-muted">A text from Leaf</div>
              <p className="m-0 mt-1 text-[15px] leading-relaxed text-fm-ink">
                Thursday dinners: next night at Sal&rsquo;s (from Jess&rsquo;s list). Which work? 1) Thu 10/9 2) Sat 10/11 3) Tue 10/14, 7pm. Reply with numbers, like 1 3.
              </p>
              <p className="m-0 mt-2 text-right text-[15px] text-fm-accent">1 3</p>
            </div>
          </div>
          <div id="start" className="scroll-mt-24">
            <StartCrewForm />
          </div>
        </section>

        <section aria-label="Crews on Leaf" className="overflow-hidden pb-16 lg:pb-24">
          <ul className="m-0 flex list-none justify-center gap-3 p-0 sm:gap-5">
            {CREWS.map((c, i) => (
              <li
                key={c.name}
                className={`relative w-32 shrink-0 overflow-hidden rounded-[22px] border border-fm-line-dim bg-fm-surface shadow-[0_18px_40px_rgba(0,0,0,0.35)] sm:w-40 ${i > 4 ? "hidden xl:block" : i > 2 ? "hidden md:block" : ""}`}
                style={{ transform: `rotate(${FAN[i]}deg) translateY(${i % 2 ? 14 : 0}px)` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.photo} alt="" loading="lazy" className="block aspect-[3/4] w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10">
                  <span className="font-fm-serif text-[19px] leading-tight text-fm-ink">{c.name}</span>
                  <span className="font-fm-mono text-[10px] uppercase tracking-[0.08em] text-fm-accent">{c.pace}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section id="how" className="scroll-mt-20 border-t border-fm-line-dim py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="m-0 font-fm-serif text-[40px] font-normal leading-tight lg:text-[52px]">How a night comes together</h2>
            <ol className="m-0 mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n} className="flex flex-col overflow-hidden rounded-[28px] border border-fm-line-dim bg-fm-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.photo} alt="" loading="lazy" className="block aspect-[4/3] w-full object-cover" />
                  <div className="flex flex-col gap-2 p-6">
                    <span className="font-fm-mono text-xs text-fm-accent">{s.n}</span>
                    <h3 className="m-0 font-fm-serif text-[28px] font-normal leading-tight">{s.title}</h3>
                    <p className="m-0 text-[15px] leading-relaxed text-fm-ink-2">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pulse" className="scroll-mt-20 border-t border-fm-line-dim py-16 lg:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,640px)] lg:gap-14">
            <div className="flex flex-col gap-4">
              <span className="font-fm-mono text-xs uppercase tracking-[0.12em] text-fm-accent">New · Crew Pulse</span>
              <h2 className="m-0 font-fm-serif text-[44px] font-normal leading-[1.02] lg:text-[56px]">
                Your friend group gets <span className="italic">a fitness tracker.</span>
              </h2>
              <p className="m-0 max-w-lg text-[17px] leading-relaxed text-fm-ink-2">
                Three rings: do people show up, does the crew keep its rhythm, and is more than one person doing the work. A score out of 100, shout-outs for the good stuff, and a card you can post.
              </p>
              <p className="m-0 text-sm text-fm-muted">Shown on a sample crew.</p>
            </div>
            <div aria-label="Sample Crew Pulse card">
              <CrewPulseCard pulse={SAMPLE_PULSE} crewName="Thursday dinners" shareToken={null} />
            </div>
          </div>
        </section>

        <section id="texts" className="border-t border-fm-line-dim py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="m-0 font-fm-serif text-[36px] font-normal leading-tight">Texts are up to you</h2>
            <p className="m-0 mt-3 text-[15px] leading-relaxed text-fm-ink-2">
              Friend Mode works in the Leaf app and on the web. If you&rsquo;d rather get date polls and the night&rsquo;s details by text, say so when you join.
              You can turn texts off any time on your crew page or by replying STOP.{" "}
              <Link href="/friends/sms-consent" className="text-fm-ink underline">How text consent works</Link>
            </p>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 border-t border-fm-line-dim py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="m-0 font-fm-serif text-[36px] font-normal leading-tight">FAQs</h2>
            <dl className="m-0 mt-6 divide-y divide-fm-line-dim">
              {FAQ.map((f) => (
                <div key={f.q} className="py-4">
                  <dt className="text-[15px] font-semibold text-fm-ink">{f.q}</dt>
                  <dd className="m-0 mt-1 text-[15px] leading-relaxed text-fm-ink-2">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-t border-fm-line-dim bg-fm-surface py-16 text-center">
          <h2 className="m-0 px-4 font-fm-serif text-[40px] font-normal leading-tight">Invite your people. Leaf does the rest.</h2>
          <a
            href="#start"
            onClick={() => trackMarketingEvent("friend_mode_cta_click", { surface: "friends_page_footer" })}
            className="mt-6 inline-flex h-12 items-center rounded-full bg-fm-accent px-7 text-[15px] font-bold text-fm-canvas"
          >
            Start a crew
          </a>
        </section>

        <MarketingFooter blurb="Leaf finds the night. You show up." dark />
      </div>
    </div>
  );
}

/**
 * The page's own header, on the page's dark ground: Friend Mode's sections
 * and a way into your crews, not the site's pricing and business links.
 */
function FriendModeNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const link = "hidden text-sm text-fm-ink-2 transition-colors hover:text-fm-ink md:block";
  return (
    <nav className="sticky top-0 z-20 border-b border-fm-line-dim bg-fm-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Leaf home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/leaf-logo-white.svg" alt="" className="h-[18px] sm:h-5" />
          <span className="font-fm-mono text-xs uppercase tracking-[0.12em] text-fm-accent">Friend Mode</span>
        </Link>
        <div className="flex items-center gap-6">
          <a href="#how" className={link}>How it works</a>
          <a href="#pulse" className={link}>Crew Pulse</a>
          <a href="#faq" className={link}>FAQs</a>
          <Link href="/me" className="text-sm font-semibold text-fm-ink transition-colors hover:text-fm-accent">
            {isLoggedIn ? "My crews" : "Log in"}
          </Link>
          <a
            href="#start"
            onClick={() => trackMarketingEvent("friend_mode_cta_click", { surface: "friends_page_nav" })}
            className="flex h-9 items-center rounded-full bg-fm-accent px-4 text-sm font-bold text-fm-canvas"
          >
            Start a crew
          </a>
        </div>
      </div>
    </nav>
  );
}
