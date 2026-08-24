"use client";

import { Calendar, Layers, Users, TrendingUp, Settings } from "lucide-react";
import type { DashboardTab } from "./types";

// Mobile bottom bar (<1024px): Home, Calendars, Community, Grow, and Settings.
// Settings shows for everyone — co-hosts get a slimmed tab (Account / Log out),
// since mobile has no sidebar footer to log out from. Inbox is reached from the
// Home header's icon; plan creation lives in the tabs' own buttons. Active item
// is zinc-900, inactive zinc-400 icon / zinc-500 label.

const ITEMS: { id: DashboardTab; label: string; icon: typeof Calendar }[] = [
  { id: "home", label: "Home", icon: Calendar },
  { id: "calendars", label: "Calendars", icon: Layers },
  { id: "community", label: "Community", icon: Users },
  { id: "grow", label: "Grow", icon: TrendingUp },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function DashboardBottomBar({
  activeTab,
  onNavigate,
}: {
  activeTab: DashboardTab;
  onNavigate: (tab: DashboardTab) => void;
}) {
  const items = ITEMS;
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-[76px] bg-white border-t border-zinc-100 flex items-start pt-2.5 pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="flex-1 flex flex-col items-center gap-[5px] min-h-[44px]"
          >
            <Icon
              className={`w-[18px] h-[18px] ${
                active ? "text-zinc-900" : "text-zinc-400"
              }`}
            />
            <span
              className={`text-[10px] font-medium ${
                active ? "text-zinc-900" : "text-zinc-500"
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
