"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import DashboardSidebar, { type DashboardSidebarProps } from "./DashboardSidebar";

/**
 * The dashboard's menu on phones: a menu button in the header that slides out
 * the same sidebar desktop shows (places, calendars, Friend Mode crews,
 * Settings / Help / Log out), so the two never drift apart. Picking anything
 * closes it. Replaces the old bottom tab bar.
 */
export default function DashboardMobileMenu(props: DashboardSidebarProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const closing = <A extends unknown[]>(fn?: (...a: A) => void) => (fn ? (...a: A) => { setOpen(false); fn(...a); } : undefined);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        aria-expanded={open}
        className="lg:hidden w-10 h-10 -ml-1.5 rounded-[10px] flex items-center justify-center text-zinc-700 hover:bg-zinc-100 shrink-0"
      >
        <Menu className="w-5 h-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-zinc-900/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-2 top-3 z-10 w-10 h-10 rounded-[10px] flex items-center justify-center text-zinc-500 hover:bg-zinc-100"
            >
              <X className="w-5 h-5" />
            </button>
            <DashboardSidebar
              {...props}
              variant="drawer"
              onNavigate={closing(props.onNavigate)!}
              onSelectCalendar={closing(props.onSelectCalendar)!}
              onAddCalendar={closing(props.onAddCalendar)!}
              onLogout={closing(props.onLogout)!}
              onSelectCrew={closing(props.onSelectCrew)}
              onStartCrew={closing(props.onStartCrew)}
            />
          </div>
        </div>
      )}
    </>
  );
}
