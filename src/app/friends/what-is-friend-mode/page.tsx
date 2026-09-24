import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "What is Friend Mode? · Leaf",
  description: "Friend Mode turns a small calendar into a group that actually meets up: Leaf picks a place, asks which dates work, and locks the night.",
};

/**
 * /friends/what-is-friend-mode — the help page behind "What is this?" on the
 * calendar page's Friend Mode banner. Written for the calendar owner deciding
 * whether to turn it on. Static, server-rendered.
 */
export default function WhatIsFriendModePage() {
  const steps: [string, string][] = [
    ["You turn it on", "Nothing is sent yet. Friend Mode is on for your calendar and you're in."],
    ["You invite your followers", "You see who gets an app notification and who gets a text, and nothing goes out until you confirm. People join with one tap or by replying IN. Anyone who doesn't join stays a follower, exactly as before."],
    ["Leaf picks a place", "From the group's shared list of spots — anyone in the group can add places they've been wanting to try."],
    ["Everyone picks dates", "Leaf offers two or three dates. People tap the ones that work (or reply with the numbers)."],
    ["Leaf locks the night", "The date that works for enough people wins, and everyone gets a normal plan invite with Accept / Decline."],
    ["Someone books it", "Whoever started that round gets the booking link. Leaf never books or pays for anything."],
    ["Then it repeats", "On the rhythm you set — every two weeks, monthly, and so on. Each person can also choose to be asked less often."],
  ];
  return (
    <main className="min-h-screen bg-[#101A16] text-[#F2F1EC]">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <p className="text-xs font-medium uppercase tracking-wide text-[#8A928C]">Leaf · Friend Mode</p>
        <h1 className="mt-1 text-2xl font-semibold">What is Friend Mode?</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#C9D1CB]">
          Recurring plans with your crew, on your schedule. Friend Mode is for small groups — up to 15 people — who want to see each
          other regularly but never get around to planning it. Leaf does the planning: it picks a place, asks everyone which dates
          work, and locks the night.
        </p>

        <h2 className="mt-8 text-lg font-semibold">How it works</h2>
        <ol className="mt-3 space-y-3">
          {steps.map(([t, d], i) => (
            <li key={t} className="flex gap-3 rounded-xl border border-[#3B5449] bg-[#253A33] p-4">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C8F25A] text-xs font-semibold text-[#101A16]">{i + 1}</span>
              <span>
                <span className="block text-[15px] font-medium">{t}</span>
                <span className="mt-0.5 block text-[14px] text-[#C9D1CB]">{d}</span>
              </span>
            </li>
          ))}
        </ol>

        <h2 className="mt-8 text-lg font-semibold">Good to know</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[14px] text-[#C9D1CB]">
          <li>People on the Leaf app get notifications in the app. Everyone else gets texts — at most 5 a week, only between 9am and 9pm.</li>
          <li>Nobody&rsquo;s phone number is shown to anyone else in the group.</li>
          <li>Anyone can leave at any time: reply STOP, or turn it off in Settings → Friend Mode in the app. Leaving Friend Mode doesn&rsquo;t unfollow your calendar.</li>
          <li>You can turn Friend Mode off from the same switch. Anything being planned stops; past nights stay.</li>
          <li>It&rsquo;s free.</li>
        </ul>

        <p className="mt-8 text-[14px] text-[#8A928C]">
          Questions? <a href="mailto:support@getleaflets.co" className="underline text-[#F2F1EC]">support@getleaflets.co</a> ·{" "}
          <Link href="/friends/sms-consent" className="underline text-[#F2F1EC]">How text consent works</Link>
        </p>
      </div>
    </main>
  );
}
