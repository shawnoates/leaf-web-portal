
/**
 * "Only on Leaf": a night a local business made for Leaf neighbors (the offer
 * pipeline stamps `onlyOnLeaf` when it publishes). The pill sits on the
 * cover; the line sits under the title on the plan's page. Both take the
 * calendar's brand color, black when it has none.
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
  return (
    <p className={`flex items-start gap-1.5 text-sm font-medium ${className}`} style={{ color: color || "#18181b" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/leaf-mark-tight.png" alt="" aria-hidden="true" className="mt-[3px] h-3.5 w-auto shrink-0" />
      <span>
        Only on Leaf{info.with ? ` · made with ${info.with} for neighbors` : " · made for neighbors"}
      </span>
    </p>
  );
}
