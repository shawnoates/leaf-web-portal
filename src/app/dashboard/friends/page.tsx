"use client";

/**
 * /dashboard/friends: the dashboard for someone in Friend Mode with no
 * calendar of their own (an individual, not an organizer). Same sidebar as
 * the org dashboard, with the Friend Mode section and a way to create a
 * calendar; a crew opens in the main pane. Organizers see the same crews
 * under their calendars on /dashboard/[calendarId].
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import Parse from "@/lib/parse-client";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import LeafSignIn from "@/components/LeafSignIn";
import CrewClient from "@/app/crew/[token]/CrewClient";
import { CrewEmbed } from "@/components/crew/CrewShell";
import { FriendModeIcon } from "@/components/crew/FriendModeGlyphs";
import StartCrewModal from "@/components/crew/StartCrewModal";
import { useMyCrews } from "@/lib/my-crews";

function FriendsDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<Parse.User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const { crews, loaded, reload } = useMyCrews(Boolean(user));
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(searchParams.get("crew"));
  const [showStartCrew, setShowStartCrew] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setUser(Parse.User.current());
      setAuthChecked(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const openCrew = (id: string | null) => {
    setSelectedCrewId(id);
    router.replace(id ? `/dashboard/friends?crew=${id}` : "/dashboard/friends", { scroll: false });
  };

  if (!authChecked) return <div className="min-h-screen bg-white" />;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="w-full max-w-sm">
          <h1 className="mb-2 text-2xl font-light tracking-tight">Log in to Leaf</h1>
          <p className="mb-6 text-sm text-zinc-500">Your crews and calendars, in one place.</p>
          <LeafSignIn
            tone="light"
            ignoreExistingSession={false}
            onSignedIn={(u) => {
              setUser(u);
              // Someone with a calendar belongs on their org dashboard.
              router.push("/dashboard?from=friends");
            }}
          />
        </div>
      </div>
    );
  }

  const name = String(user.get("full_name") || user.get("name") || "You");

  return (
    <div className="min-h-screen bg-white lg:flex">
      <DashboardSidebar
        orgless
        orgName={name}
        tierLabel="Friend Mode"
        logoUrl={null}
        activeTab="crew"
        needsYouCount={0}
        inboxUnread={0}
        calendars={[]}
        selectedCalendarId={null}
        isOwner
        onNavigate={() => {}}
        onSelectCalendar={() => {}}
        onAddCalendar={() => router.push("/")}
        onLogout={async () => {
          try { await Parse.User.logOut(); } catch { /* ignore */ }
          router.push("/friends");
        }}
        crews={crews}
        selectedCrewId={selectedCrewId}
        onSelectCrew={openCrew}
        onStartCrew={() => setShowStartCrew(true)}
      />
      {showStartCrew && (
        <StartCrewModal
          onClose={() => { setShowStartCrew(false); void reload(); }}
          onOpenCrew={(id) => { setShowStartCrew(false); void reload(); openCrew(id); }}
        />
      )}

      <main className="min-w-0 flex-1">
        {selectedCrewId ? (
          <div className="p-3 lg:p-6">
            <button type="button" onClick={() => openCrew(null)} className="mb-3 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 lg:hidden">
              <ArrowLeft className="h-4 w-4" aria-hidden /> All crews
            </button>
            <CrewEmbed>
              <CrewClient key={selectedCrewId} token={selectedCrewId} />
            </CrewEmbed>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl px-5 py-8 lg:px-10 lg:py-12">
            <div className="mb-8 flex items-center gap-3">
              <FriendModeIcon size={36} />
              <div>
                <h1 className="m-0 text-2xl font-semibold tracking-tight text-zinc-900">Friend Mode</h1>
                <p className="m-0 text-sm text-zinc-500">Your crews. Leaf plans the nights; you show up.</p>
              </div>
            </div>
            {!loaded ? (
              <p className="text-sm text-zinc-400">Loading your crews…</p>
            ) : (
              <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {crews.map((c) => (
                  <li key={c.crewId}>
                    <button
                      type="button"
                      onClick={() => openCrew(c.crewId)}
                      className={`flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-400 ${c.status === "off" || c.status === "paused" ? "opacity-60" : ""}`}
                    >
                      {c.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                      ) : (
                        <FriendModeIcon size={40} className="shrink-0" />
                      )}
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[15px] font-semibold text-zinc-900">{c.name}</span>
                        {c.statusLine && <span className="truncate text-xs text-zinc-500">{c.statusLine}</span>}
                      </span>
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => setShowStartCrew(true)}
                    className="flex h-full min-h-[74px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 p-4 text-sm font-medium text-zinc-600 hover:border-zinc-500 hover:text-zinc-900"
                  >
                    <Plus className="h-4 w-4" aria-hidden /> Start a crew
                  </button>
                </li>
              </ul>
            )}
            <p className="mt-10 text-sm text-zinc-500">
              Run a club, a building or a community?{" "}
              <Link href="/" className="font-medium text-zinc-900 underline underline-offset-4">Create a calendar</Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function FriendsDashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <FriendsDashboard />
    </Suspense>
  );
}
