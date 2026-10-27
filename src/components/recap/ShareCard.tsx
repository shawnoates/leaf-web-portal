"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import Parse from "@/lib/parse-client";

// "Share this night": the attendee's personal link to the calendar. Copying or
// sharing pays nothing; the server pays points when a friend follows the
// calendar for the first time from the link (leaflets-server share-rewards.js).
// The amount comes from the server, never hardcoded here. Renders nothing when
// the server has no link for this plan (private calendar, or they didn't attend).

type ShareLink = {
  link: string | null;
  calendarName?: string | null;
  planTitle?: string | null;
  venueName?: string | null;
  neighborhood?: string | null;
  pointsPerFollow?: number;
  monthlyCap?: number;
};

// "Thursday run at Still Studio was great. More events in Williamsburg: <link>"
// Built from what the server knows about the plan; every piece is optional.
function captionFor(share: ShareLink, link: string): string {
  const title = share.planTitle?.trim();
  const venue = share.venueName?.trim();
  const hood = share.neighborhood?.trim();
  const opener = title ? (venue && !title.includes(venue) ? `${title} at ${venue} was great.` : `${title} was great.`) : "Had a great time.";
  const more = hood
    ? `More events in ${hood}`
    : share.calendarName ? `More from ${share.calendarName}` : "More events like this";
  return `${opener} ${more}, follow along: ${link}`;
}

export default function ShareCard({ notificationId }: { notificationId: string }) {
  const [share, setShare] = useState<ShareLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Parse.Cloud.run("getMyShareLink", { notificationId })
      .then((res: ShareLink) => {
        if (!cancelled) setShare(res);
      })
      .catch(() => {
        // Nothing to share is not an error worth showing.
      });
    return () => {
      cancelled = true;
    };
  }, [notificationId]);

  if (!share?.link) return null;
  const link = share.link;
  const name = share.calendarName || "this calendar";
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the share sheet or long-press on the field still works.
    }
  }

  const caption = captionFor(share, link);

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCaptionCopied(true);
      window.setTimeout(() => setCaptionCopied(false), 2000);
    } catch {
      // Clipboard blocked: the caption is shown below to select by hand.
    }
  }

  async function send() {
    try {
      await navigator.share({ title: name, text: caption });
    } catch {
      // Cancelled.
    }
  }

  return (
    <div className="mt-5 pt-5 border-t border-zinc-100">
      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">
        Share this night
      </h3>
      <p className="text-xs text-zinc-500 mb-3">
        Post it anywhere. When a friend follows {name} for the first time from your link
        {share.pointsPerFollow ? `, you earn ${share.pointsPerFollow} Leaf points` : ", you earn Leaf points"}.
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Your link"
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600"
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={send}
            aria-label="Share"
            className="inline-flex items-center border border-zinc-300 text-zinc-700 px-3 py-2 rounded-lg hover:bg-zinc-50"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 select-all">{caption}</p>
      <button
        type="button"
        onClick={copyCaption}
        className="mt-2 text-xs font-medium text-zinc-600 underline hover:text-zinc-900"
      >
        {captionCopied ? "Caption copied" : "Copy caption"}
      </button>
    </div>
  );
}
