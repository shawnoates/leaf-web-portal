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

import { Tag, Wallet } from "lucide-react";

const GREEN = "#253a33";

function SaveLine({ total, member, onJoin, className = "" }: { total: string; member: boolean; onJoin: () => void; className?: string }) {
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
export function ClubNeighborCardPrice({ total, member, onJoin }: { total: string; member: boolean; onJoin: () => void }) {
  return (
    <div className="-mt-3 flex flex-col gap-2.5">
      <p className={`m-0 flex items-center gap-3 text-xs font-bold uppercase tracking-widest ${member ? "text-zinc-500" : "text-zinc-900"}`}>
        <span className="flex w-8 justify-center"><Wallet className="h-3.5 w-3.5" aria-hidden /></span>
        {member ? <s>{total} a ticket</s> : <>{total} a ticket</>}
      </p>
      <p className="m-0 flex items-center gap-3 text-xs font-bold uppercase tracking-widest" style={{ color: GREEN }}>
        <span className="flex w-8 justify-center"><Tag className="h-3.5 w-3.5" aria-hidden /></span>
        Free with Club Neighbor
      </p>
      <SaveLine total={total} member={member} onJoin={onJoin} className="mt-1.5 border-t border-zinc-200 pt-3.5" />
    </div>
  );
}

/** The detail popup's date row: the price item and the Club Neighbor item beside it. */
export function ClubNeighborModalPrice({ total, member }: { total: string; member: boolean }) {
  return (
    <>
      <span className={`flex items-center gap-2 whitespace-nowrap font-normal ${member ? "text-zinc-500" : "text-zinc-900"}`}>
        <Wallet className="h-4 w-4 flex-shrink-0" aria-hidden />
        {member ? <s>{total} a ticket</s> : <>{total} a ticket</>}
      </span>
      <span className="flex items-center gap-2 whitespace-nowrap font-semibold" style={{ color: GREEN }}>
        <Tag className="h-4 w-4 flex-shrink-0" aria-hidden />
        Free with Club Neighbor
      </span>
    </>
  );
}

/** The detail popup's pinned footer: what they'd save, above the ticket button. */
export function ClubNeighborModalSaveLine({ total, member, onJoin }: { total: string; member: boolean; onJoin: () => void }) {
  return <SaveLine total={total} member={member} onJoin={onJoin} className="mb-3.5" />;
}
