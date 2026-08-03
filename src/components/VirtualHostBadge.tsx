"use client";

import { useState } from "react";
import { Info } from "lucide-react";

interface VirtualHostPersona {
  name: string | null;
}

// "Virtual" + info tooltip (click/tap-to-toggle, since a plain `title=`
// attribute never fires on mobile) plus a grayscale "Beta" pill. Shared by
// the org calendar page's plan card and modal (kept in sync deliberately —
// see the "mirrors the card's precedence" comment in page.tsx) and by the
// plan chat bubble.
export default function VirtualHostBadge({ persona }: { persona?: VirtualHostPersona | null }) {
  const [open, setOpen] = useState(false);
  const name = persona?.name || "Your host";

  return (
    <span className="relative inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 bg-zinc-900/5 text-zinc-700 rounded-full pl-2 pr-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest">
        Virtual
        <button
          type="button"
          aria-label={`What's a virtual host?`}
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className="leading-none text-zinc-500 hover:text-zinc-800"
        >
          <Info className="w-3 h-3" />
        </button>
      </span>
      <span className="bg-zinc-100 text-zinc-500 border border-zinc-200 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold">
        Beta
      </span>
      {open && (
        <span
          role="tooltip"
          className="absolute z-20 top-full mt-1.5 left-0 w-64 rounded-lg bg-zinc-900 text-white text-xs leading-relaxed p-3 shadow-lg normal-case tracking-normal font-normal"
        >
          {name} is a virtual host — a blend of real human and AI support hired by the community organizer to help plan and facilitate this event.
        </span>
      )}
    </span>
  );
}
