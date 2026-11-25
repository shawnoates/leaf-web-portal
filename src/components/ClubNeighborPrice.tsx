"use client";

/**
 * The Club Neighbor price on a merchant-hosted ("Only on Leaf") ticketed
 * night, on the calendar page: its plan card and its detail popup.
 *
 * Shown only when the server sends `clubNeighbor` for the calendar, which an
 * admin switches on per calendar and which is off until members' tickets
 * really are free (leaflets-server cloud/deals-offer.js). A member sees the
 * ticket price crossed out; everyone else sees it beside "Free with Club
 * Neighbor", with a line saying what they'd save tonight and a Join button
 * that opens the Club Neighbor popup.
 */

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Tag, Wallet } from "lucide-react";
import Parse from "@/lib/parse-client";

const GREEN = "#253a33";

function SaveLine({ total, member, poolSpent, onJoin, className = "" }: { total: string; member: boolean; poolSpent?: boolean; onJoin: () => void; className?: string }) {
  // A member in a month whose budget is used up: the ticket is the normal
  // price, and the page says why instead of promising a free one.
  if (poolSpent) {
    return (
      <p className={`m-0 text-sm leading-snug text-zinc-600 ${className}`}>
        <span className="font-semibold text-zinc-900">This month&rsquo;s free spots are gone.</span> This one is the normal price; your free outings are back next month.
      </p>
    );
  }
  if (member) {
    return (
      <p className={`m-0 text-sm leading-snug text-zinc-600 ${className}`}>
        <span className="font-semibold text-zinc-900">You save {total} on this night.</span> Included with Club Neighbor.
      </p>
    );
  }
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <p className="m-0 min-w-0 flex-1 text-sm leading-snug text-zinc-600">
        <span className="font-semibold text-zinc-900">Save {total} on this night</span> with Club Neighbor, $8.25 a month. 30-day money-back guarantee.
      </p>
      <button
        type="button"
        onClick={onJoin}
        className="h-11 shrink-0 rounded-full px-[18px] text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: GREEN }}
      >
        Join
      </button>
    </div>
  );
}

/** The plan card: the price row, the Club Neighbor row under it, then the save line. */
export function ClubNeighborCardPrice({ total, member, poolSpent, onJoin }: { total: string; member: boolean; poolSpent?: boolean; onJoin: () => void }) {
  return (
    <div className="-mt-3 flex flex-col gap-2.5">
      <p className={`m-0 flex items-center gap-3 text-xs font-bold uppercase tracking-widest ${member ? "text-zinc-500" : "text-zinc-900"}`}>
        <span className="flex w-8 justify-center"><Wallet className="h-3.5 w-3.5" aria-hidden /></span>
        {member ? <s>{total} a ticket</s> : <>{total} a ticket</>}
      </p>
      {!poolSpent && (
        <p className="m-0 flex items-center gap-3 text-xs font-bold uppercase tracking-widest" style={{ color: GREEN }}>
          <span className="flex w-8 justify-center"><Tag className="h-3.5 w-3.5" aria-hidden /></span>
          Free with Club Neighbor
        </p>
      )}
      <SaveLine total={total} member={member} poolSpent={poolSpent} onJoin={onJoin} className="mt-1.5 border-t border-zinc-200 pt-3.5" />
    </div>
  );
}

/** The detail popup's date row: the price item and the Club Neighbor item beside it. */
export function ClubNeighborModalPrice({ total, member, poolSpent }: { total: string; member: boolean; poolSpent?: boolean }) {
  return (
    <>
      <span className={`flex items-center gap-2 whitespace-nowrap font-normal ${member ? "text-zinc-500" : "text-zinc-900"}`}>
        <Wallet className="h-4 w-4 flex-shrink-0" aria-hidden />
        {member ? <s>{total} a ticket</s> : <>{total} a ticket</>}
      </span>
      {!poolSpent && (
        <span className="flex items-center gap-2 whitespace-nowrap font-semibold" style={{ color: GREEN }}>
          <Tag className="h-4 w-4 flex-shrink-0" aria-hidden />
          Free with Club Neighbor
        </span>
      )}
    </>
  );
}

/** The detail popup's pinned footer: what they'd save, above the ticket button. */
export function ClubNeighborModalSaveLine({ total, member, poolSpent, onJoin }: { total: string; member: boolean; poolSpent?: boolean; onJoin: () => void }) {
  return <SaveLine total={total} member={member} poolSpent={poolSpent} onJoin={onJoin} className="mb-3.5" />;
}

type OutingInfo = {
  isFree: boolean;
  priceCents: number | null;
  url: string | null;
  sourceLabel: string;
  seats: number;
  seatsLeft: number;
  seatsBought: boolean;
  claimed: boolean;
};

/**
 * A Club Neighbor outing: an outside event Leaf found for members and an
 * admin approved (leaflets-server cloud/club-neighbor-outings.js). Asks the
 * server what this viewer can do and shows it:
 *   - a free event: anyone RSVPs as usual;
 *   - a paid one Leaf bought seats for: a member claims a seat free until
 *     they run out; everyone else gets the price and the link to buy.
 * Renders nothing for any other plan, so a page can mount it for every plan.
 */
export function ClubNeighborOutingBox({ planId, onClaimed, className = "" }: { planId: string; onClaimed?: () => void; className?: string }) {
  const [info, setInfo] = useState<{ outing: OutingInfo; isMember: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = (await Parse.Cloud.run("getClubNeighborForPlan", { planId })) as { outing?: OutingInfo | null; isMember?: boolean };
      setInfo(r?.outing ? { outing: r.outing, isMember: r.isMember === true } : null);
    } catch {
      setInfo(null);
    }
  }, [planId]);
  useEffect(() => {
    let cancelled = false;
    Parse.Cloud.run("getClubNeighborForPlan", { planId })
      .then((r: { outing?: OutingInfo | null; isMember?: boolean }) => {
        if (!cancelled) setInfo(r?.outing ? { outing: r.outing, isMember: r.isMember === true } : null);
      })
      .catch(() => { /* not an outing, as far as this page knows */ });
    return () => { cancelled = true; };
  }, [planId]);

  if (!info) return null;
  const { outing, isMember } = info;
  const price = outing.priceCents != null ? `$${(outing.priceCents / 100).toFixed(outing.priceCents % 100 ? 2 : 0)}` : null;
  const signedIn = !!Parse.User.current();

  async function claim() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const r = (await Parse.Cloud.run("claimClubNeighborSeat", { planId })) as { claimed: boolean; reason?: string };
      if (!r.claimed) setNote("The last free seat was just taken.");
      await load();
      if (r.claimed) onClaimed?.();
    } catch (e) {
      setNote(e instanceof Error && e.message ? e.message : "That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const link = outing.url ? (
    <a href={outing.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium underline underline-offset-4 sm:min-h-0" style={{ color: GREEN }}>
      {outing.isFree ? `Details on ${outing.sourceLabel}` : `Tickets on ${outing.sourceLabel}`} <ArrowUpRight className="h-4 w-4" aria-hidden />
    </a>
  ) : null;

  let body: React.ReactNode;
  if (outing.isFree) {
    body = <p className="m-0 text-sm text-zinc-600"><span className="font-semibold text-zinc-900">Free for everyone.</span> RSVP so the group knows you&rsquo;re coming.</p>;
  } else if (outing.claimed) {
    body = <p className="m-0 text-sm text-zinc-600"><span className="font-semibold text-zinc-900">You have a seat.</span> Leaf bought your ticket, and your host will get it to you before the night.</p>;
  } else if (isMember && outing.seatsBought && outing.seatsLeft > 0) {
    body = (
      <>
        <p className="m-0 text-sm text-zinc-600">
          <span className="font-semibold text-zinc-900">Free with Club Neighbor.</span>{" "}
          {price ? <><s>{price}</s> · </> : null}{outing.seatsLeft} of {outing.seats} {outing.seats === 1 ? "seat" : "seats"} left, first come first served.
        </p>
        <button
          type="button"
          onClick={claim}
          disabled={busy}
          className="h-11 w-full rounded-full px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
          style={{ backgroundColor: GREEN }}
        >
          {busy ? "One moment…" : "Claim my free seat"}
        </button>
      </>
    );
  } else {
    const gone = isMember && outing.seatsBought && outing.seatsLeft === 0;
    body = (
      <>
        <p className="m-0 text-sm text-zinc-600">
          {gone && <><span className="font-semibold text-zinc-900">Members&rsquo; free seats are gone.</span>{" "}</>}
          {price ? `Tickets are ${price} each from the organizer.` : "Tickets are sold by the organizer."}
          {!isMember && outing.seatsBought && outing.seatsLeft > 0 && <> Free for Club Neighbor members while {outing.seatsLeft} {outing.seatsLeft === 1 ? "seat lasts" : "seats last"}.</>}
        </p>
        {!signedIn && outing.seatsBought && outing.seatsLeft > 0 && (
          <p className="m-0 text-sm text-zinc-600">A member? <a href="/me" className="underline underline-offset-4" style={{ color: GREEN }}>Sign in</a>, then come back to claim your seat.</p>
        )}
      </>
    );
  }

  return (
    <div className={`flex flex-col items-start gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 ${className}`}>
      <p className="m-0 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: GREEN }}>
        <Tag className="h-3.5 w-3.5" aria-hidden /> Club Neighbor outing
      </p>
      {body}
      {note && <p role="status" className="m-0 text-sm text-zinc-700">{note}</p>}
      {!outing.claimed && link}
    </div>
  );
}
