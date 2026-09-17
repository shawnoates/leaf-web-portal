"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

// Cross-promotion attribution — "this plan came from another calendar."
// Two variants per the design spec (Cross-promo Attribution, option 1C):
//   <CrossPromoPhotoBadge/>  dark badge over a plan card's photo
//   <CrossPromoEyebrow/>     light eyebrow above the date line in a detail header
// Both lead with the source calendar's avatar (never truncated), ellipsize the
// name, and link to the source calendar's public page.

export interface CrossPromoSource {
  name: string | null;
  shareId: string | null;
  photoUrl?: string | null;
}

function Avatar({ name, photoUrl }: CrossPromoSource) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" aria-hidden="true" className="w-[18px] h-[18px] rounded-[5px] object-cover flex-none" />;
  }
  return (
    <span
      aria-hidden="true"
      className="w-[18px] h-[18px] rounded-[5px] flex-none inline-flex items-center justify-center bg-[#1f3a5f] text-white text-[9px] font-bold"
    >
      {(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

// A card is usually itself clickable (opens the plan); the badge must not
// also trigger that.
function stop(e: MouseEvent) {
  e.stopPropagation();
}

function Wrapper({
  source,
  className,
  children,
}: {
  source: CrossPromoSource;
  className: string;
  children: ReactNode;
}) {
  const label = `Shared from ${source.name || "another calendar"}`;
  if (source.shareId) {
    return (
      <Link href={`/org/${source.shareId}`} aria-label={label} title={label} onClick={stop} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <span aria-label={label} title={label} className={className}>
      {children}
    </span>
  );
}

/** Bottom-left badge over a plan photo. The parent must be `position: relative`. */
export function CrossPromoPhotoBadge({ source }: { source: CrossPromoSource }) {
  return (
    <Wrapper
      source={source}
      className="absolute left-3 bottom-3 z-[1] max-w-[calc(100%-24px)] inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-[7px] bg-[rgba(17,17,17,0.78)] hover:bg-[rgba(17,17,17,0.9)] backdrop-blur-[8px] text-white text-xs font-semibold tracking-normal whitespace-nowrap no-underline cursor-pointer transition-colors"
    >
      <Avatar {...source} />
      <span className="overflow-hidden text-ellipsis">{source.name || "Another calendar"}</span>
    </Wrapper>
  );
}

/** Eyebrow above a detail header's date line. Hugs its content. */
export function CrossPromoEyebrow({ source }: { source: CrossPromoSource }) {
  return (
    <Wrapper
      source={source}
      className="group/xp self-start max-w-full inline-flex items-center gap-2 pl-[5px] pr-2.5 py-[5px] rounded-md bg-[#f2f2f0] hover:bg-[#e9e9e6] text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap no-underline cursor-pointer transition-colors"
    >
      <Avatar {...source} />
      <span className="text-[#7a7a78]">Shared from</span>
      <span className="text-[#111] group-hover/xp:text-[#555] overflow-hidden text-ellipsis transition-colors">
        {source.name || "Another calendar"}
      </span>
    </Wrapper>
  );
}
