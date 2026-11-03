"use client";

// The paid host's link for their network (host share bonus, 2026-11-03).
// One link, any number of people: each person new to Leaf who RSVPs through it
// adds `perCents` to the host's pay, up to `capCents`. The count is the
// server's (getHostOffer → share), the same "new to Leaf" rule as the pitch
// bonus in the host board email.

import { useState } from "react";
import { smsHref } from "@/lib/plan-invite";

export type HostShareInfo = {
  url: string;
  smsBody: string;
  perCents: number;
  capCents: number;
  newPeopleCount: number;
  earnedCents: number;
  termsLine: string | null;
};

const money = (cents: number) =>
  cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;

export default function HostShareCard({ share }: { share: HostShareInfo }) {
  const [copied, setCopied] = useState(false);
  const capped = share.capCents > 0 && share.earnedCents >= share.capCents;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is on screen to select by hand.
    }
  };

  const shareSheet = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: share.smsBody });
        return;
      } catch {
        // Dismissed, or not allowed here: fall back to copying.
      }
    }
    await copy();
  };

  return (
    <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="text-[17px] font-semibold text-leaf-900">Share it with your people</h2>
      {share.termsLine && (
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">{share.termsLine}</p>
      )}

      <div className="mt-4 rounded-lg bg-leaf-50 px-4 py-3">
        <p className="text-[15px] font-medium text-leaf-900">
          {share.newPeopleCount === 0
            ? "No one new yet"
            : `${share.newPeopleCount} new ${share.newPeopleCount === 1 ? "person" : "people"} RSVP'd through your link`}
        </p>
        {share.perCents > 0 && (
          <p className="mt-0.5 text-[14px] text-leaf-800">
            {capped
              ? `${money(share.earnedCents)} added to your pay, the most this night pays`
              : `${money(share.earnedCents)} added to your pay so far`}
          </p>
        )}
      </div>

      <p className="mt-4 break-all rounded-lg border border-zinc-200 px-3 py-2.5 text-[14px] text-zinc-700">
        {share.url}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <a
          href={smsHref(share.smsBody)}
          className="rounded-lg bg-leaf-800 px-4 py-3 text-center text-[15px] font-medium text-white transition-colors hover:bg-leaf-900"
        >
          Text it
        </a>
        <button
          onClick={shareSheet}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-[15px] font-medium text-leaf-900 transition-colors hover:border-zinc-400"
        >
          {copied ? "Link copied" : "Share or copy"}
        </button>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-zinc-500">
        Counts people whose first RSVP on Leaf is this plan, through this link. You&rsquo;re
        paid it with the night, after you confirm you hosted.
      </p>
    </div>
  );
}
