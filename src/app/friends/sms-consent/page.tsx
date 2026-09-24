import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Friend Mode text-message consent · Leaf",
  description: "How people opt in to Leaf Friend Mode text messages: an optional, unchecked checkbox, never a condition of using Leaf.",
};

/**
 * /friends/sms-consent — a static, server-rendered record of how consent is
 * collected for Friend Mode texts, for carrier (A2P 10DLC) review. The opt-in
 * screens are behind sign-in or a personal link, so this page shows their
 * exact wording. Nothing here submits anything.
 */
function Box({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 flex items-start gap-2 rounded-xl border border-zinc-300 p-3 text-[13px]">
      <input type="checkbox" disabled className="mt-0.5" aria-label={`${label} (example, not pre-checked)`} />
      <span>{children}</span>
    </label>
  );
}

export default function SmsConsentPage() {
  const number = process.env.NEXT_PUBLIC_FRIEND_MODE_NUMBER || "(646) 588-1360";
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-zinc-800">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Leaf · Friend Mode</p>
      <h1 className="mt-1 text-2xl font-semibold text-zinc-900">How people consent to Friend Mode text messages</h1>
      <p className="mt-2 text-[15px]">
        Friend Mode texts are sent by Leaf by One Common LLC, operating as Leaf, from {number}. Friend Mode lets a small group
        (up to 15 people) plan recurring get-togethers: Leaf proposes a place and dates, members pick what works, and Leaf confirms
        the night. Texting is never required. Everything works in the Leaf app and on the web without it.
      </p>
      <p className="mt-2 text-[15px]">
        Leaf sends no message from this number until the person checks the unchecked box below, or texts a keyword (IN, JOIN or
        START) to this number themselves. The box is never pre-checked, and every form submits whether or not it is checked.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">1. Invited members, on their crew page</h2>
      <p className="mt-1 text-[15px]">
        A calendar owner invites the calendar&rsquo;s followers. The invitation is an app notification or a text from Leaf&rsquo;s
        existing number, the one followers already agreed to hear from. It is <strong>not</strong> sent from the Friend Mode number:
      </p>
      <div className="mt-3 rounded-xl border border-zinc-300 p-3 text-sm">
        Leaf: [Owner&rsquo;s name] from [Calendar name] wants to plan a get-together soon. Join here: [personal link] Reply STOP to opt out.
      </div>
      <p className="mt-3 text-[15px]">The link opens their crew page. Joining is one button; the text box is separate and optional:</p>
      <div className="mt-3 rounded-xl border border-zinc-300 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">You&rsquo;re invited</p>
        <p className="mt-1 text-sm">Join [Crew name] and Leaf finds a night that works for the group and plans it, every month.</p>
        <Box label="SMS consent">
          <strong>Text me about this crew&rsquo;s plans</strong><br />
          Date polls and the night&rsquo;s details, so you don&rsquo;t have to open the app. Up to 5 msgs/wk. Msg &amp; data rates may apply.
          Reply HELP for help, STOP to opt out.
        </Box>
        <div className="mt-3 flex gap-2">
          <div className="inline-block rounded-full bg-zinc-200 px-4 py-2 text-sm text-zinc-600">Join</div>
          <div className="inline-block rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-600">No thanks</div>
        </div>
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        Members who join without checking it can check the same box later on the crew page (&ldquo;Want these by text instead?&rdquo;), and can
        turn texts off there at any time.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">2. The calendar owner, when turning Friend Mode on</h2>
      <p className="mt-1 text-[15px]">
        The owner turns Friend Mode on from their calendar&rsquo;s page in the Leaf dashboard (signed in). Under the switch:
      </p>
      <div className="mt-3 rounded-xl border border-zinc-300 p-4">
        <p className="text-sm font-medium">Friend Mode — Recurring plans with your crew, on your schedule</p>
        <Box label="Owner SMS consent">
          <strong>Text me about this crew&rsquo;s plans</strong> — up to 5 msgs/wk. Msg &amp; data rates may apply. Reply HELP for help,
          STOP to opt out. You can change this on the crew page.
        </Box>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">Messages</h2>
      <div className="mt-3 space-y-2 rounded-xl border border-zinc-300 p-4 text-sm">
        <p><span className="text-zinc-500">First message after opting in:</span> Leaf: you&rsquo;ll get texts about [Crew name]&rsquo;s plans. Up to 5 msgs/wk. Msg &amp; data rates may apply. Reply HELP for help, STOP to opt out.</p>
        <p><span className="text-zinc-500">Typical message:</span> [Crew name]: next night at [Place]. Which work? 1) Thu 10/9 2) Sat 10/11, 7pm. Reply with numbers (like 1 3) or OUT. [link]</p>
        <p><span className="text-zinc-500">STOP, any time:</span> Leaf Friend Mode: you&rsquo;re unsubscribed and won&rsquo;t get any more texts from us. Text JOIN anytime to come back.</p>
        <p><span className="text-zinc-500">HELP:</span> Leaf Friend Mode: texts about nights with your crew, up to 5 msgs/wk. Msg &amp; data rates may apply. Reply IN/OUT to answer, PLAN to start a night, STOP to opt out. Help: support@getleaflets.co</p>
      </div>

      <p className="mt-8 text-sm text-zinc-500">
        Questions: <a href="mailto:support@getleaflets.co" className="underline">support@getleaflets.co</a> ·{" "}
        <Link href="/terms-conditions" className="underline">Terms</Link> · <Link href="/privacy-policy" className="underline">Privacy Policy</Link> ·{" "}
        <Link href="/help/calendars-and-rsvps/friend-mode" className="underline">What is Friend Mode?</Link>
      </p>
    </main>
  );
}
