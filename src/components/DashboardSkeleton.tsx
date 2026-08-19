"use client";

import { Calendar, Layers, Heart, Users, TrendingUp, Ticket, Settings } from "lucide-react";

/**
 * Loading chrome for the owner dashboard.
 *
 * The dashboard page is a client component with no server-rendered content —
 * the SSR response is nothing but a loading state, and the real UI only paints
 * after ~600KB of JS boots and Parse returns. Rendering a centered spinner for
 * that window meant the first paint (spinner, vertically centered in an empty
 * viewport) and the second (header + tabs + content) shared no geometry at all,
 * so every load ended in a visible jump.
 *
 * This mirrors the real chrome instead: same header height, same max-w-5xl
 * gutters, same tab strip, same `<main>` padding. The skeleton and the loaded
 * dashboard occupy the same boxes, so the swap only fills in text rather than
 * moving it.
 *
 * Keep the structure here in sync with the header/nav/main in
 * `app/dashboard/[calendarId]/page.tsx` — if the two drift, the jump comes back.
 */

// Mirrors TABS in the dashboard page. Labels are static, so the tab strip can
// render for real (not as grey bars) before any data arrives — it's the single
// biggest block of chrome we can paint early.
const SKELETON_TABS = [
  { label: "Overview", icon: Calendar },
  { label: "Calendars", icon: Layers },
  { label: "Followers", icon: Heart },
  { label: "Users", icon: Users },
  { label: "Analytics", icon: TrendingUp },
  { label: "Marketplace", icon: Ticket },
  { label: "Settings", icon: Settings },
];

function Bar({ className = "" }: { className?: string }) {
  return <div className={`bg-zinc-100 rounded animate-pulse ${className}`} />;
}

export default function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-white" aria-busy="true" aria-label="Loading dashboard">
      <header className="border-b border-zinc-100">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            {/* org name (text-xl) + tier line (text-xs) */}
            <Bar className="h-5 w-48 max-w-full" />
            <Bar className="h-3 w-20" />
          </div>
          <Bar className="h-4 w-14 shrink-0" />
          <Bar className="h-4 w-10 shrink-0" />
        </div>

        <div className="max-w-5xl mx-auto px-6">
          <nav className="flex gap-1 -mb-px overflow-x-auto no-scrollbar">
            {SKELETON_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <span
                  key={tab.label}
                  className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium uppercase tracking-widest border-b-2 border-transparent text-zinc-300 whitespace-nowrap select-none"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </span>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Stat row + two content cards — the Overview shape, which is where
            every load that doesn't specify ?tab= ends up. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border border-zinc-200 rounded-xl p-5 space-y-3">
              <Bar className="h-3 w-16" />
              <Bar className="h-7 w-12" />
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-4">
          <div className="border border-zinc-200 rounded-xl p-6 space-y-4">
            <Bar className="h-3 w-32" />
            <Bar className="h-24 w-full" />
          </div>
          <div className="border border-zinc-200 rounded-xl p-6 space-y-4">
            <Bar className="h-3 w-40" />
            <Bar className="h-16 w-full" />
          </div>
        </div>
      </main>
    </div>
  );
}
