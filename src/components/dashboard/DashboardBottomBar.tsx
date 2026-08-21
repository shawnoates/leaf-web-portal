"use client";

import { Calendar, Layers, Users, TrendingUp, Plus } from "lucide-react";
import type { DashboardTab } from "./types";

// Mobile bottom bar (<1024px): Home, Calendars, center + FAB, Community, Grow.
// Inbox is reached from the Home header's icon. Active item is zinc-900,
// inactive zinc-400 icon / zinc-500 label. The FAB opens the create-plan flow.

const ITEMS: { id: DashboardTab; label: string; icon: typeof Calendar }[] = [
  { id: "home", label: "Home", icon: Calendar },
  { id: "calendars", label: "Calendars", icon: Layers },
  { id: "community", label: "Community", icon: Users },
  { id: "grow", label: "Grow", icon: TrendingUp },
];

export default function DashboardBottomBar({
  activeTab,
  onNavigate,
  onCreate,
}: {
  activeTab: DashboardTab;
  onNavigate: (tab: DashboardTab) => void;
  onCreate: () => void;
}) {
  const renderItem = (item: (typeof ITEMS)[number]) => {
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
  };

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-[76px] bg-white border-t border-zinc-100 flex items-start pt-2.5 pb-[env(safe-area-inset-bottom)]">
      {renderItem(ITEMS[0])}
      {renderItem(ITEMS[1])}
      <div className="w-[60px] flex justify-center shrink-0">
        <button
          onClick={onCreate}
          aria-label="New plan"
          className="w-[52px] h-[52px] -mt-6 rounded-full bg-zinc-900 text-white flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.18)] active:bg-zinc-800"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
      {renderItem(ITEMS[2])}
      {renderItem(ITEMS[3])}
    </div>
  );
}
