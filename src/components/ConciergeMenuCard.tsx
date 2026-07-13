"use client";

import { useState } from "react";
import Parse from "@/lib/parse-client";
import { Check, Sparkles, Loader2 } from "lucide-react";

export interface ConciergeMenuOption {
  objectId: string;
  title: string;
  description: string;
  whatItIs?: string | null;
  suggestedDate: string | null;
  suggestedTime: string | null;
  expectedTurnout: number | null;
  image: string | null;
  category: string | null;
  costType: string | null;
  ownerPrice: number | null;
  residentCost?: string | null;
  location?: string | null;
  leadDays?: number;
  timelyOccasion?: string | null;
}

export interface ConciergeMenu {
  menuId: string;
  calendarId: string | null;
  calendarName: string | null;
  month: string | null;
  autonomyMode: "approve" | "veto_window" | "autopilot" | string;
  hostNote: string | null;
  preselectedOptionId: string | null;
  vetoDeadline: string | null;
  options: ConciergeMenuOption[];
}

/**
 * "This month's menu" selection card for the owner dashboard.
 *
 * Shows the concierge's curated options for the current `awaiting_selection`
 * menu; the owner picks one, which locks the menu and publishes the event to
 * their calendar (server: selectMenuOption → _publishPlanOptionToCalendar).
 * For veto_window / autopilot menus, the preselected option is badged and a
 * deadline is shown, but the owner can still override by choosing another.
 */
export default function ConciergeMenuCard({
  menu,
  onSelected,
}: {
  menu: ConciergeMenu;
  onSelected: () => void;
}) {
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monthLabel = menu.month
    ? new Date(`${menu.month}-01T12:00:00Z`).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "This month";

  const deadlineLabel = menu.vetoDeadline
    ? new Date(menu.vetoDeadline).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;

  const select = async (optionId: string) => {
    setSelectingId(optionId);
    setError(null);
    try {
      await Parse.Cloud.run("selectMenuOption", { menuId: menu.menuId, optionId });
      onSelected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't select that option.");
      setSelectingId(null);
    }
  };

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-xl shadow-black/40">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
        <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      </div>

      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-lg font-semibold tracking-tight text-white">
              Your {monthLabel} menu is ready
            </h3>
          </div>
          {deadlineLabel && (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest bg-white/10 text-zinc-200 px-2.5 py-0.5 rounded-full">
              Choose by {deadlineLabel}
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-400 leading-relaxed mb-1">
          {menu.autonomyMode === "approve"
            ? "Pick the event you'd like us to run"
            : "We'll run the highlighted pick unless you choose another"}
          {menu.calendarName ? ` for ${menu.calendarName}` : ""}.
        </p>
        {menu.hostNote && (
          <p className="text-xs text-zinc-500 italic mb-4">“{menu.hostNote}”</p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {menu.options.map((opt) => {
            const isPreselected = opt.objectId === menu.preselectedOptionId;
            const busy = selectingId === opt.objectId;
            const date = fmtDate(opt.suggestedDate);
            return (
              <div
                key={opt.objectId}
                className={`flex flex-col rounded-xl border bg-white/[0.03] overflow-hidden ${
                  isPreselected ? "border-emerald-500/50" : "border-white/10"
                }`}
              >
                {opt.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={opt.image}
                    alt={opt.title}
                    className="h-28 w-full object-cover"
                  />
                ) : (
                  <div className="h-28 w-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
                )}
                <div className="flex flex-1 flex-col p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-white truncate">{opt.title}</h4>
                    {isPreselected && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest bg-emerald-500 text-black px-1.5 py-0.5 rounded-full">
                        Pick
                      </span>
                    )}
                  </div>
                  {(date || opt.suggestedTime) && (
                    <p className="text-xs text-emerald-400 mb-1">
                      {[date, opt.suggestedTime].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="text-xs text-zinc-400 leading-snug line-clamp-3 flex-1">
                    {opt.description}
                  </p>
                  <button
                    onClick={() => select(opt.objectId)}
                    disabled={!!selectingId}
                    className="mt-3 inline-flex items-center justify-center gap-1.5 bg-white text-black px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors disabled:opacity-60"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scheduling…
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" /> Choose this
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
      </div>
    </div>
  );
}
