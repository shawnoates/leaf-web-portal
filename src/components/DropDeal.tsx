/**
 * A Drop's deal on the calendar's plan sheet, in the /me popup's design: what
 * you get with its value struck through beside the fee, the spots left as
 * seats, and the terms. The venue line is there because a Drop's venue only
 * comes with the pass.
 */

import { money } from "@/lib/drops";

export default function DropDeal({
  includes,
  valueCents,
  feeCents,
  capacity,
  spotsLeft,
}: {
  includes: string;
  valueCents: number;
  feeCents: number;
  capacity: number | null;
  spotsLeft: number | null;
}) {
  const worth = valueCents > feeCents ? money(valueCents) : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4 rounded-xl bg-[#f3f7f5] px-4 py-3">
        <div className="min-w-0 flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6f6a5f]">You get</span>
          {includes && <p className="text-sm leading-snug text-zinc-900">{includes}</p>}
        </div>
        <p className="flex-none flex items-baseline gap-2">
          {worth && <s className="text-sm text-[#8b8578]" aria-label={`worth ${worth}`}>{worth}</s>}
          <strong className="text-2xl font-semibold text-zinc-900">{money(feeCents)}</strong>
        </p>
      </div>
      {capacity && spotsLeft !== null && <Seats capacity={capacity} left={spotsLeft} />}
      <p className="text-xs text-zinc-500">
        Venue revealed with your pass · First come, first served · Full refund if you cancel 48+ hours before
      </p>
    </div>
  );
}

/** Open seats lit, taken ones dim; a bar past 24. */
function Seats({ capacity, left }: { capacity: number; left: number }) {
  const label = left > 0 ? `${left} of ${capacity} spots left` : `All ${capacity} spots claimed`;
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-[#3f6212]" role="img" aria-label={label}>
      {capacity <= 24 ? (
        <span className="flex gap-[3px]" aria-hidden="true">
          {Array.from({ length: capacity }, (_, i) => (
            <span key={i} className={`w-[6px] h-3 rounded-[1px] ${i < capacity - left ? "bg-zinc-200" : "bg-[#65a30d]"}`} />
          ))}
        </span>
      ) : (
        <span className="w-24 h-1 rounded-sm bg-zinc-200 overflow-hidden" aria-hidden="true">
          <span className="block h-full bg-[#65a30d]" style={{ width: `${(left / capacity) * 100}%` }} />
        </span>
      )}
      <span aria-hidden="true">{label}</span>
    </div>
  );
}
