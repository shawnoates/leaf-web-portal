"use client";

import { Calendar, Users, TrendingUp, Mail } from "lucide-react";

/**
 * Loading chrome for the owner dashboard.
 *
 * The dashboard page is a client component with no server-rendered content —
 * the SSR response is nothing but a loading state, and the real UI only paints
 * after ~600KB of JS boots and Parse returns. Rendering a centered spinner for
 * that window meant the first paint and the second shared no geometry at all,
 * so every load ended in a visible jump.
 *
 * This mirrors the redesigned chrome instead: the fixed 232px sidebar with the
 * five places, the Home header row, the three-counter grid, and two content
 * cards. Nav labels render for real immediately; only data-bearing text is a
 * pulsing bar, so the skeleton and the loaded dashboard occupy the same boxes.
 *
 * Keep the structure here in sync with the sidebar/header/main in
 * `app/dashboard/[calendarId]/page.tsx` — if the two drift, the jump comes back.
 */

// Mirrors NAV_ITEMS in DashboardSidebar. Labels are static, so the nav can
// render for real (not as grey bars) before any data arrives — it's the single
// biggest block of chrome we can paint early.
const SKELETON_NAV = [
  { label: "Home", icon: Calendar },
  { label: "Community", icon: Users },
  { label: "Grow", icon: TrendingUp },
  { label: "Inbox", icon: Mail },
];

function Bar({ className = "" }: { className?: string }) {
  return <div className={`bg-zinc-100 rounded animate-pulse ${className}`} />;
}

export default function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-white lg:flex" aria-busy="true" aria-label="Loading dashboard">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-[232px] shrink-0 flex-col bg-zinc-50 border-r border-zinc-100 px-3.5 py-[18px]">
        <div className="flex items-center gap-2.5 px-2 pb-4">
          <Bar className="w-7 h-7 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Bar className="h-3.5 w-28" />
            <Bar className="h-2.5 w-14" />
          </div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {SKELETON_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <span
                key={item.label}
                className="flex items-center gap-[9px] px-2.5 py-[9px] text-[13px] font-medium text-zinc-300 select-none"
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </span>
            );
          })}
        </nav>
        <p className="text-[9px] font-semibold tracking-[0.14em] text-zinc-300 uppercase mt-[22px] mb-2 px-2.5 select-none">
          Calendars
        </p>
        <div className="flex flex-col gap-2 px-2.5">
          <Bar className="h-4 w-36" />
          <Bar className="h-4 w-28" />
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden border-b border-zinc-100 px-4 py-3.5 flex items-center gap-3">
          <Bar className="w-[30px] h-[30px] rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Bar className="h-3.5 w-32" />
            <Bar className="h-2.5 w-20" />
          </div>
          <Bar className="w-8 h-8 rounded-[9px] shrink-0" />
        </header>

        {/* Home header row */}
        <div className="px-4 sm:px-6 lg:px-8 py-4 lg:py-5 border-b border-zinc-100 flex items-center gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <Bar className="h-5 w-48 max-w-full" />
            <Bar className="h-3 w-64 max-w-full" />
          </div>
          <Bar className="h-[34px] w-28 rounded-full shrink-0" />
          <Bar className="hidden sm:block h-[38px] w-28 rounded-full shrink-0" />
        </div>

        <main className="px-4 sm:px-6 lg:px-8 py-5 lg:py-6">
          {/* Three counters — the Home shape, which is where every load that
              doesn't specify ?tab= ends up. */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="border border-zinc-200 rounded-xl p-3 sm:p-4 space-y-3">
                <Bar className="h-3 w-16" />
                <Bar className="h-7 w-12" />
              </div>
            ))}
          </div>

          <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">
            <div className="space-y-4">
              <div className="border border-zinc-200 rounded-xl p-6 space-y-4">
                <Bar className="h-3 w-32" />
                <Bar className="h-24 w-full" />
              </div>
              <div className="border border-zinc-200 rounded-xl p-6 space-y-4">
                <Bar className="h-3 w-40" />
                <Bar className="h-16 w-full" />
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="border border-zinc-200 rounded-xl p-4 space-y-3">
                <Bar className="h-3 w-28" />
                <Bar className="h-24 w-full" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
