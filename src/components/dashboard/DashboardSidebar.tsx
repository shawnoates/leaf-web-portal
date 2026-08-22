"use client";

import Link from "next/link";
import {
  Calendar,
  Users,
  TrendingUp,
  Mail,
  Plus,
} from "lucide-react";
import type { DashboardTab, OrgDashboardCalendar } from "./types";

// Persistent desktop sidebar (≥1024px) for the redesigned dashboard.
// Carries the org switcher block, the five places, the calendar list, and the
// footer (Settings / Help / Log out). Mobile gets DashboardBottomBar instead.

// "calendars" is deliberately absent: on desktop the CALENDARS list below is
// the navigation for that tab (mobile keeps it in DashboardBottomBar).
const NAV_ITEMS: { id: DashboardTab; label: string; icon: typeof Calendar }[] = [
  { id: "home", label: "Home", icon: Calendar },
  { id: "community", label: "Community", icon: Users },
  { id: "grow", label: "Grow", icon: TrendingUp },
  { id: "inbox", label: "Inbox", icon: Mail },
];

export default function DashboardSidebar({
  orgName,
  tierLabel,
  logoUrl,
  activeTab,
  needsYouCount,
  inboxUnread,
  calendars,
  selectedCalendarId,
  isOwner,
  onNavigate,
  onSelectCalendar,
  onAddCalendar,
  onLogout,
}: {
  orgName: string;
  tierLabel: string;
  logoUrl: string | null;
  activeTab: DashboardTab;
  needsYouCount: number;
  inboxUnread: number;
  calendars: OrgDashboardCalendar[];
  selectedCalendarId: string | null;
  isOwner: boolean;
  onNavigate: (tab: DashboardTab) => void;
  onSelectCalendar: (id: string) => void;
  onAddCalendar: () => void;
  onLogout: () => void;
}) {
  return (
    <aside className="hidden lg:flex w-[232px] shrink-0 flex-col bg-zinc-50 border-r border-zinc-100 px-3.5 py-[18px] sticky top-0 h-screen overflow-y-auto">
      {/* Org switcher block */}
      <div className="flex items-center gap-2.5 px-2 pb-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="w-7 h-7 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div className="w-7 h-7 rounded-lg bg-zinc-200 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-semibold text-zinc-500">
              {orgName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-zinc-900 truncate">
            {orgName}
          </p>
          <p className="text-[10px] text-zinc-400">{tierLabel} Plan</p>
        </div>
      </div>

      {/* Places */}
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-[9px] px-2.5 py-[9px] rounded-lg text-left transition-colors ${
                active ? "" : "hover:bg-zinc-100"
              }`}
            >
              {active && (
                <span className="w-[3px] h-[15px] rounded-sm bg-zinc-900 -ml-1.5" />
              )}
              <Icon
                className={`w-3.5 h-3.5 shrink-0 ${
                  active ? "text-zinc-900" : "text-zinc-400"
                }`}
              />
              <span
                className={`text-[13px] font-medium ${
                  active ? "text-zinc-900" : "text-zinc-600"
                }`}
              >
                {item.label}
              </span>
              <span className="flex-1" />
              {item.id === "home" && needsYouCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-zinc-900 text-white text-[10px] font-semibold leading-5 text-center">
                  {needsYouCount}
                </span>
              )}
              {item.id === "inbox" && inboxUnread > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Calendars */}
      <p className="text-[9px] font-semibold tracking-[0.14em] text-zinc-400 uppercase mt-[22px] mb-2 px-2.5">
        Calendars
      </p>
      <div className="flex flex-col gap-0.5">
        {calendars.map((cal) => {
          const selected =
            activeTab === "calendars" && selectedCalendarId === cal.objectId;
          return (
            <button
              key={cal.objectId}
              onClick={() => onSelectCalendar(cal.objectId)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                selected
                  ? "bg-white border border-zinc-200"
                  : "border border-transparent hover:bg-zinc-100"
              } ${cal.isActive === false ? "opacity-60" : ""}`}
            >
              {cal.calendarImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cal.calendarImage}
                  alt=""
                  className="w-[18px] h-[18px] rounded-[5px] object-cover shrink-0"
                />
              ) : (
                <div className="w-[18px] h-[18px] rounded-[5px] bg-zinc-100 border border-zinc-200 shrink-0" />
              )}
              <span
                className={`text-xs truncate ${
                  selected
                    ? "font-medium text-zinc-900"
                    : "font-normal text-zinc-700"
                }`}
              >
                {cal.name}
              </span>
            </button>
          );
        })}
        {isOwner && (
          <button
            onClick={onAddCalendar}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New calendar
          </button>
        )}
      </div>

      <div className="flex-1" />

      {/* Footer */}
      <div className="border-t border-zinc-200 pt-2.5 mt-4 flex flex-col">
        {isOwner && (
          <button
            onClick={() => onNavigate("settings")}
            className={`px-2.5 py-2 rounded-lg text-left text-xs transition-colors hover:bg-zinc-100 ${
              activeTab === "settings"
                ? "text-zinc-900 font-medium"
                : "text-zinc-500"
            }`}
          >
            Settings
          </button>
        )}
        <Link
          href="/help"
          target="_blank"
          className="px-2.5 py-2 rounded-lg text-xs text-zinc-500 hover:bg-zinc-100 transition-colors"
        >
          Help
        </Link>
        <button
          onClick={onLogout}
          className="px-2.5 py-2 rounded-lg text-left text-xs text-zinc-500 hover:bg-zinc-100 hover:text-red-700 transition-colors"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
