import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Friend Mode text-message consent · Leaf",
  description: "How people consent to Leaf Friend Mode text messages: the web form checkboxes and the text-to-join keyword.",
};

/**
 * /friends/sms-consent — a static, server-rendered record of how consent is
 * collected for Friend Mode texts, for carrier (A2P 10DLC) review. It shows
 * the exact wording of the consent step at /crew/start (which is a client
 * flow a crawler can't read) and the text-to-join exchange. Nothing here
 * submits anything.
 */
export default function SmsConsentPage() {
  const number = process.env.NEXT_PUBLIC_FRIEND_MODE_NUMBER || "(646) 588-1360";
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-zinc-800">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Leaf · Friend Mode</p>
      <h1 className="mt-1 text-2xl font-semibold text-zinc-900">How people consent to Friend Mode text messages</h1>
      <p className="mt-2 text-[15px]">
        Text messages are sent by Leaf by One Common LLC, operating as Leaf. People consent in one of two ways.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">1. Web form (the person starting a crew)</h2>
      <p className="mt-1 text-[15px]">
        At <Link href="/crew/start" className="underline">joinleaf.com/crew/start</Link>, after naming the crew and adding friends, the last step
        collects the organizer&rsquo;s name and mobile number. Both boxes below start unchecked and both must be ticked before a
        verification code is sent or any invitation goes out. This is the step exactly as it appears:
      </p>
      <div className="mt-4 rounded-xl border border-zinc-300 p-4">
        <p className="text-lg font-semibold text-zinc-900">Last thing: you</p>
        <p className="mt-1 text-sm text-zinc-600">Your friends will see your name. We text you a code to prove the number is yours.</p>
        <div className="mt-3 space-y-2">
          <div className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-400">Your name</div>
          <div className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-400">Your phone</div>
        </div>
        <div className="mt-3 space-y-2 rounded-xl border border-zinc-300 p-3 text-[13px]">
          <label className="flex items-start gap-2">
            <input type="checkbox" disabled className="mt-0.5" aria-label="SMS consent (example, not pre-checked)" />
            <span>
              I agree to receive text messages from Leaf about my crew&rsquo;s plans at the number I provide. Up to 5 msgs/wk.
              Msg &amp; data rates may apply. Reply HELP for help, STOP to opt out.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" disabled className="mt-0.5" aria-label="Terms and Privacy consent (example, not pre-checked)" />
            <span>
              I agree to the <Link href="/terms-conditions" className="underline">Terms of Service</Link> and{" "}
              <Link href="/privacy-policy" className="underline">Privacy Policy</Link>.
            </span>
          </label>
        </div>
        <div className="mt-3 inline-block rounded-full bg-zinc-200 px-4 py-2 text-sm text-zinc-500">Text me a code</div>
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        After verifying the code they receive: &ldquo;You&rsquo;re in [Crew name] on Leaf. Up to 5 msgs/wk about nights with your crew.
        Msg &amp; data rates may apply. Reply HELP for help, STOP to cancel.&rdquo;
      </p>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">2. By text (friends who are invited, or anyone who texts JOIN)</h2>
      <p className="mt-1 text-[15px]">
        Anyone can text <strong>JOIN</strong> to <strong>{number}</strong> (advertised at{" "}
        <Link href="/friends#text-to-join" className="underline">joinleaf.com/friends</Link>). When a friend adds someone to a crew, Leaf
        sends one invitation and nothing further unless they reply <strong>IN</strong>.
      </p>
      <div className="mt-4 rounded-xl border border-zinc-300 p-4 text-sm">
        <p><span className="text-zinc-500">Invitation from Leaf:</span> [Friend&rsquo;s name] added you to [Crew name] on Leaf. Leaf finds a night that works for everyone and plans it. Reply IN to join. Up to 5 msgs/wk. Msg &amp; data rates may apply. Reply HELP for help, STOP to opt out.</p>
        <p className="mt-2"><span className="text-zinc-500">Recipient:</span> IN</p>
        <p className="mt-2"><span className="text-zinc-500">Leaf (enrollment confirmation):</span> You&rsquo;re in [Crew name] on Leaf. Up to 5 msgs/wk about nights with your crew. Msg &amp; data rates may apply. Reply HELP for help, STOP to cancel.</p>
        <p className="mt-2"><span className="text-zinc-500">If a stranger texts JOIN:</span> Leaf Friend Mode: start a crew or join one here: joinleaf.com/crew/start. When a friend adds you, reply IN to their invite. Up to 5 msgs/wk. Msg &amp; data rates may apply. Reply HELP for help, STOP to opt out.</p>
        <p className="mt-2"><span className="text-zinc-500">STOP, any time:</span> Leaf Friend Mode: you&rsquo;re unsubscribed and won&rsquo;t get any more texts from us. Text JOIN anytime to come back.</p>
        <p className="mt-2"><span className="text-zinc-500">HELP:</span> Leaf Friend Mode: texts about nights with your crew, up to 5 msgs/wk. Msg &amp; data rates may apply. Reply IN/OUT to answer, PLAN to start a night, STOP to opt out. Help: support@getleaflets.co</p>
      </div>

      <p className="mt-8 text-sm text-zinc-500">
        Questions: <a href="mailto:support@getleaflets.co" className="underline">support@getleaflets.co</a> ·{" "}
        <Link href="/terms-conditions" className="underline">Terms</Link> · <Link href="/privacy-policy" className="underline">Privacy Policy</Link>
      </p>
    </main>
  );
}
