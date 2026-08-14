"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

interface VirtualHostPersona {
  name: string | null;
}

// Info tooltip (click/tap-to-toggle, since a plain `title=` attribute never
// fires on mobile) sitting after the host name. Shared by the org calendar
// page's plan card and modal (kept in sync deliberately — see the "mirrors
// the card's precedence" comment in page.tsx), the plan detail modal, and the
// plan chat bubble.
//
// The visible "AI-Assisted" label was dropped once every surface adopted
// "Organized by {name}" — the two together read as redundant hedging on a card
// that already says who arranged the plan. The tooltip is now the disclosure,
// so the icon stays: it's the only remaining path to "who is Marcus, exactly?"
// and deleting it would leave attendees no way to find out at all.
export default function VirtualHostBadge({ persona }: { persona?: VirtualHostPersona | null }) {
  const [open, setOpen] = useState(false);
  const name = persona?.name || "Your host";
  const rootRef = useRef<HTMLSpanElement>(null);

  // Tap/click anywhere outside dismisses the tooltip, same as a native
  // popover — otherwise it stays pinned open over whatever's underneath.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex items-center gap-1 text-zinc-400">
      <button
        type="button"
        aria-label={`What's an AI-assisted host?`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        // Padding (negative-margined back out, so nothing shifts) gives the
        // icon a real tap target. It used to sit beside a label; now it's the
        // only thing here, and a bare 12px glyph isn't reliably tappable.
        className="leading-none text-zinc-400 hover:text-zinc-600 p-1 -m-1"
      >
        <Info className="w-3 h-3" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-20 top-full mt-1.5 left-0 w-64 rounded-lg bg-zinc-900 text-white text-xs leading-relaxed p-3 shadow-lg normal-case tracking-normal font-normal text-left"
        >
          {name} is an AI-assisted host — a blend of real human and AI support hired by the community organizer to help plan and facilitate this event.
        </span>
      )}
    </span>
  );
}
