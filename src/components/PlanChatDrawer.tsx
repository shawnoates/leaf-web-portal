"use client";

import { X } from "lucide-react";
import ChatShell from "./Chat/ChatShell";

// Lightweight drawer wrapper around the existing ChatShell. Owners
// opening a plan's chat from the dashboard get an inline slide-over
// instead of navigating away to /chat/[eventGroupId], keeping their
// dashboard context intact.
//
// Same drawer skeleton as LeafHostThread + LeafHostPlanThread —
// right-side desktop, full-height bottom sheet on mobile.
export default function PlanChatDrawer({
  eventGroupId,
  onClose,
}: {
  eventGroupId: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex md:justify-end items-end md:items-stretch bg-zinc-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full md:w-[560px] md:max-w-[95vw] rounded-t-2xl md:rounded-none md:rounded-l-2xl md:shadow-2xl relative flex flex-col h-[92vh] md:h-full overflow-hidden"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 text-zinc-500 hover:text-zinc-900 z-20 bg-white/90 rounded-full backdrop-blur-sm"
          aria-label="Close chat"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* hidePlanDetails hides ChatShell's built-in plan sidebar +
              mobile top header. Owner opened this drawer from a plan
              card that already told them what plan they're looking at,
              and the drawer itself owns the close affordance. */}
          <ChatShell eventGroupId={eventGroupId} hidePlanDetails fitParent />
        </div>
      </div>
    </div>
  );
}
