"use client";

import { X } from "lucide-react";
import InviteFriendsSection from "./InviteFriendsSection";

/**
 * A plan's "Text friends from your contacts", opened on top of the plan the
 * way its chat is (same drawer skeleton as PlanChatDrawer: right side on
 * desktop, a tall bottom sheet on phones), so the host never leaves the plan.
 * Grow → Invite friends is the same tool with the calendar and plan pickers.
 */
export default function TextFriendsDrawer({
  calendarId,
  planId,
  planTitle,
  onClose,
}: {
  calendarId: string;
  planId: string;
  planTitle: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex md:justify-end items-end md:items-stretch bg-zinc-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Text friends"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full md:w-[560px] md:max-w-[95vw] rounded-t-2xl md:rounded-none md:rounded-l-2xl md:shadow-2xl relative flex flex-col h-[92vh] md:h-full overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-zinc-100">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-900">Text friends</h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              Each gets their own link to {planTitle}. Leaf tells you who opens it and who RSVPs.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-zinc-500 hover:text-zinc-900 rounded-full shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
          <InviteFriendsSection
            embedded
            calendars={[{ objectId: calendarId, name: "", activePlans: [] }]}
            defaultCalendarId={calendarId}
            defaultPlanId={planId}
          />
        </div>
      </div>
    </div>
  );
}
