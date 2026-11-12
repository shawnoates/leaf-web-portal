"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, MoreHorizontal, Plus } from "lucide-react";
import type { OrgDashboardCalendar } from "@/components/dashboard/types";

/**
 * Phone header for the Calendars tab: menu, the open calendar as the title
 * (tap it to switch), and a round + for a new plan. It stands in for the org
 * bar, the calendar header and the calendar chips, which stacked four bands
 * above the first plan. The org name, plan tier and Inbox live in the menu.
 */
export function CalendarsMobileTitle({
  menu,
  calendars,
  selected,
  onSelect,
  onAdd,
  onNewPlan,
}: {
  /** The menu button (DashboardMobileMenu), so it keeps its own drawer. */
  menu: ReactNode;
  calendars: OrgDashboardCalendar[];
  selected: OrgDashboardCalendar;
  onSelect: (id: string) => void;
  /** Owners only: add a calendar (the caller handles the tier limit). */
  onAdd?: () => void;
  /** Absent when the calendar can't take plans (inactive). */
  onNewPlan?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, ref, () => setOpen(false));
  const canSwitch = calendars.length > 1 || !!onAdd;
  const inactive = selected.isActive === false;

  return (
    <header className="lg:hidden border-b border-zinc-100 px-4 py-2.5 flex items-center gap-2">
      {menu}
      <div ref={ref} className="relative flex-1 min-w-0">
        <button
          type="button"
          onClick={() => canSwitch && setOpen((o) => !o)}
          aria-haspopup={canSwitch ? "listbox" : undefined}
          aria-expanded={canSwitch ? open : undefined}
          className="max-w-full flex items-center gap-1.5 py-1.5 text-left"
        >
          <span className={`truncate text-[16px] font-semibold tracking-[-0.01em] ${inactive ? "text-zinc-400" : "text-zinc-900"}`}>
            {selected.name}
          </span>
          {inactive && (
            <span className="shrink-0 px-1.5 py-[2px] bg-amber-100 text-amber-700 rounded-[5px] text-[9px] font-semibold tracking-[0.1em] uppercase">
              Inactive
            </span>
          )}
          {canSwitch && <ChevronDown className={`w-4 h-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />}
        </button>
        {open && (
          <div
            role="listbox"
            aria-label="Calendars"
            className="absolute left-0 top-full mt-1 z-40 w-[min(300px,calc(100vw-2rem))] bg-white border border-zinc-200 rounded-xl shadow-lg py-1.5"
          >
            {calendars.map((c) => {
              const sel = c.objectId === selected.objectId;
              return (
                <button
                  key={c.objectId}
                  type="button"
                  role="option"
                  aria-selected={sel}
                  onClick={() => { setOpen(false); onSelect(c.objectId); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-zinc-50"
                >
                  <Check className={`w-4 h-4 shrink-0 ${sel ? "text-zinc-900" : "text-transparent"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${sel ? "font-semibold text-zinc-900" : "text-zinc-700"} ${c.isActive === false ? "opacity-60" : ""}`}>
                      {c.name}
                    </span>
                    {(c.isPrimary || c.city) && (
                      <span className="block truncate text-[11px] text-zinc-400">
                        {[c.isPrimary ? "Primary" : null, c.city].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            {onAdd && (
              <button
                type="button"
                onClick={() => { setOpen(false); onAdd(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm text-zinc-500 hover:bg-zinc-50 border-t border-zinc-100 mt-1"
              >
                <Plus className="w-4 h-4 shrink-0" /> New calendar
              </button>
            )}
          </div>
        )}
      </div>
      {onNewPlan && (
        <button
          type="button"
          onClick={onNewPlan}
          aria-label="New plan"
          className="w-9 h-9 shrink-0 rounded-full bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-800"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </header>
  );
}

export type CalendarAction = {
  label: string;
  onSelect?: () => void;
  href?: string;
  /** Opens in a new tab (the public calendar page). */
  external?: boolean;
  badge?: number;
};

/**
 * The ⋯ next to the plan tabs on phones: everything the calendar header's
 * buttons did (link, edit, promote, concierge, crew settings), plus the
 * calendar's address, which the title row has no room for.
 */
export function CalendarActionsMenu({ actions, caption }: { actions: CalendarAction[]; caption?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, ref, () => setOpen(false));
  const badged = actions.some((a) => (a.badge ?? 0) > 0);
  const item = "w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50";

  return (
    <div ref={ref} className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Calendar actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100"
      >
        <MoreHorizontal className="w-5 h-5" />
        {badged && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-40 w-60 bg-white border border-zinc-200 rounded-xl shadow-lg py-1.5">
          {actions.map((a) => {
            const body = (
              <>
                <span>{a.label}</span>
                {(a.badge ?? 0) > 0 && (
                  <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{a.badge}</span>
                )}
              </>
            );
            return a.href ? (
              <a
                key={a.label}
                role="menuitem"
                href={a.href}
                {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                onClick={() => setOpen(false)}
                className={item}
              >
                {body}
              </a>
            ) : (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); a.onSelect?.(); }}
                className={item}
              >
                {body}
              </button>
            );
          })}
          {caption && <p className="px-3.5 pt-2 pb-1 mt-1 border-t border-zinc-100 text-[11px] text-zinc-400 truncate">{caption}</p>}
        </div>
      )}
    </div>
  );
}

function useDismiss(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, close]);
}
