
/**
 * "Only on Leaf": a night a local business made for Leaf neighbors (the offer
 * pipeline stamps `onlyOnLeaf` when it publishes). The pill sits on the
 * cover; the line is a small chip above the title on the plan's page
 * (2026-10-18: the business's name is already in the title and the host
 * row, so the chip just says "Only on Leaf"; "made with …" is its tooltip).
 * Both take the calendar's brand color, black when it has none.
 */

export type OnlyOnLeafInfo = { with: string | null } | null | undefined;

export function OnlyOnLeafPill({ color }: { color?: string | null }) {
  return (
    <span
      className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-sm"
      style={{ backgroundColor: color || "#18181b" }}
    >
      {/* The Leaf mark, white on the pill. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/leaf-mark-tight.png" alt="" aria-hidden="true" className="h-3 w-auto brightness-0 invert" />
      Only on Leaf
    </span>
  );
}

export function OnlyOnLeafLine({ info, color, className = "" }: { info: OnlyOnLeafInfo; color?: string | null; className?: string }) {
  if (!info) return null;
  const made = info.with ? `Made with ${info.with} for Leaf neighbors` : "Made for Leaf neighbors";
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${className}`}
      style={{ color: color || "#18181b", borderColor: "rgba(24, 24, 27, 0.12)" }}
      title={made}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/leaf-mark-tight.png" alt="" aria-hidden="true" className="h-3 w-auto shrink-0" />
      Only on Leaf
      <span className="sr-only">. {made}</span>
    </span>
  );
}
