import type { Metadata } from "next";
import Link from "next/link";
import { FriendModeIcon } from "@/components/crew/FriendModeGlyphs";

export const metadata: Metadata = {
  title: "Friend Mode · Leaf",
  description: "Friend Mode is turned on from a calendar you own on Leaf.",
};

/**
 * /crew/start — Friend Mode is turned on from a calendar's page in the
 * dashboard (owner only); invited people join from their own crew link.
 * The old standalone setup flow (name, friends' numbers, phone code) is
 * retired, so this page just points people to the right place. Older links
 * and CTAs still land somewhere useful.
 */
export default function StartCrewPage() {
  return (
    <main className="min-h-screen bg-[#101A16] text-[#F2F1EC]">
      <div className="mx-auto max-w-xl px-5 py-12">
        <FriendModeIcon size={48} />
        <h1 className="mt-4 text-2xl font-semibold">Friend Mode starts from your calendar</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#C9D1CB]">
          Recurring plans with your crew, on your schedule. If you own a calendar with 15 followers or fewer, open it in your
          dashboard and flip the Friend Mode switch at the top. Then invite your followers when you&rsquo;re ready.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-[#C9D1CB]">
          Were you invited? Use the link in your invitation to join.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard" className="rounded-full bg-[#C8F25A] px-5 py-2.5 text-[15px] font-medium text-[#101A16]">Open your dashboard</Link>
          <Link href="/help/calendars-and-rsvps/friend-mode" className="rounded-full border border-[#3B5449] px-5 py-2.5 text-[15px] text-[#F2F1EC]">What is Friend Mode?</Link>
        </div>
      </div>
    </main>
  );
}
