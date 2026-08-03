"use client";

import { useState } from "react";
import { Info } from "lucide-react";

interface VirtualHostPersona {
  name: string | null;
}

// Plain-text "AI-Assisted" + info tooltip (click/tap-to-toggle, since a plain
// `title=` attribute never fires on mobile) — deliberately lighter/smaller
// than the host name it sits next to, not a pill. Shared by the org calendar
// page's plan card and modal (kept in sync deliberately — see the "mirrors
// the card's precedence" comment in page.tsx) and by the plan chat bubble.
export default function VirtualHostBadge({ persona }: { persona?: VirtualHostPersona | null }) {
  const [open, setOpen] = useState(false);
  const name = persona?.name || "Your host";

  return (
    <span className="relative inline-flex items-center gap-1 text-zinc-400">
      <span className="text-[10px] font-normal normal-case tracking-normal">AI-Assisted</span>
      <button
        type="button"
        aria-label={`What's an AI-assisted host?`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="leading-none text-zinc-400 hover:text-zinc-600"
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
