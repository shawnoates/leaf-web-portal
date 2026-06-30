"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { Calendar, ChevronRight, Plus, Users } from "lucide-react";
import { getRandomStreakQuote, type StreakQuote } from "@/lib/streak-quotes";

interface OrgSummary {
  objectId: string;
  name: string;
  description: string;
  shareId: string;
  orgType: string | null;
  tier: string;
  brandColor: string;
  profilePhoto: string | null;
  memberCount: number;
  calendarCount: number;
  upcomingPlanCount: number;
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
        </div>
      }
    >
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<Parse.User | null>(null);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [redirecting, setRedirecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  // Pick once on mount so SSR/CSR match and the quote doesn't flicker between renders.
  const [quote, setQuote] = useState<StreakQuote | null>(null);
  useEffect(() => { setQuote(getRandomStreakQuote()); }, []);

  useEffect(() => {
    try {
      const current = Parse.User.current();
      if (current) {
        setUser(current);
      }
    } catch {
      // No session
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchOrg();
  }, [user]);

  async function fetchOrg() {
    setLoading(true);
    try {
      const result = await Parse.Cloud.run("getMyOrganizations");
      const organizations: OrgSummary[] = result.organizations || [];

      // No orgs → setup
      if (organizations.length === 0) {
        router.push("/organizations/setup");
        return;
      }

      // Exactly one → behave as before, hop straight in
      if (organizations.length === 1) {
        setRedirecting(true);
        const qs = searchParams.toString();
        router.push(
          `/dashboard/${organizations[0].objectId}${qs ? `?${qs}` : ""}`
        );
        return;
      }

      // 2+ → show picker so existing-account holders see all their calendars
      setOrgs(organizations);
    } catch (error) {
      console.error("Failed to fetch organization:", error);
      // Invalid or expired session — log out so the sign-in page shows
      try {
        await Parse.User.logOut();
      } catch {
        // ignore logout errors
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <div className="min-h-screen flex">
        {/* Left visual panel — desktop only */}
        <div className="hidden md:flex relative w-1/2 lg:w-3/5 overflow-hidden bg-zinc-900">
          <video
            className="absolute inset-0 w-full h-full object-cover opacity-60 scale-105"
            src="/dashboard-hero.mp4"
            autoPlay
            muted
            loop
            playsInline
            poster="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=2000"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-black/50 to-black/80" />
          <div className="relative z-10 flex flex-col justify-between p-12 lg:p-16 text-white w-full">
            <Link href="/" className="flex items-center gap-3">
              <img src="/leaf-logo-white.svg" alt="Leaf" className="h-7" />
              <span className="text-lg font-light tracking-wider uppercase">OS</span>
            </Link>
            <div className="space-y-6 max-w-md min-h-[180px]">
              {quote && (
                <>
                  <p className="text-3xl lg:text-4xl font-light tracking-tight leading-tight">
                    &ldquo;{quote.quote}&rdquo;
                  </p>
                  <p className="text-xs uppercase tracking-wider text-white/60">
                    — {quote.author}
                  </p>
                </>
              )}
            </div>
            <p className="text-xs uppercase tracking-wider text-white/50">
              Leaf OS · For Organizations
            </p>
          </div>
        </div>

        {/* Right sign-in panel */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white">
          <div className="max-w-sm w-full text-center">
            <Calendar className="w-10 h-10 mx-auto mb-4 text-zinc-400 md:hidden" />
            <h1 className="text-2xl font-light tracking-tight mb-2">
              Sign in to manage your organization
            </h1>
            <p className="text-sm text-zinc-500 mb-8">
              Access your dashboard, edit calendars, and manage your subscription.
            </p>
            <GoogleSignInButton
              onSignIn={(u) => setUser(u)}
              onError={(err) => console.error("Sign-in error:", err)}
            />
          </div>
        </div>
      </div>
    );
  }

  // Signed in: still resolving, redirecting to a single org, or showing the picker.
  if (loading || redirecting) {
    return (
      <div className="min-h-screen bg-white">
        <main className="max-w-4xl mx-auto px-6 py-10">
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
          </div>
        </main>
      </div>
    );
  }

  // Multi-calendar picker — runs when an existing user with 2+ calendars
  // signs in. Fixes the bug where claim-flow signups for existing emails
  // could only see one calendar.
  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-2">
            Your calendars
          </p>
          <h1 className="text-3xl font-light tracking-tight">
            Pick a calendar to open
          </h1>
          <p className="text-sm text-zinc-500 mt-2">
            You manage {orgs.length} calendars. Open one to keep going, or set up a new one.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {orgs.map((org) => {
            const qs = searchParams.toString();
            const href = `/dashboard/${org.objectId}${qs ? `?${qs}` : ""}`;
            const tierLabel =
              org.tier === "concierge"
                ? "Concierge"
                : org.tier === "pro"
                ? "Pro"
                : "Free";
            return (
              <Link
                key={org.objectId}
                href={href}
                className="group bg-white border border-zinc-200 hover:border-zinc-900 transition-colors p-5 rounded-2xl"
              >
                <div className="flex items-start gap-4">
                  {org.profilePhoto ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={org.profilePhoto}
                      alt={org.name}
                      className="w-12 h-12 rounded-xl object-cover bg-zinc-100"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-semibold"
                      style={{ backgroundColor: org.brandColor || "#18181b" }}
                    >
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-900 truncate">
                      {org.name}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{tierLabel}</p>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-2">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {org.memberCount}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {org.upcomingPlanCount} upcoming
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 transition-colors shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}
        </div>

        <Link
          href="/organizations/setup"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 px-4 py-2 border border-zinc-300 hover:border-zinc-900 rounded-full transition-colors"
        >
          <Plus className="w-4 h-4" />
          Set up another calendar
        </Link>
      </main>
    </div>
  );
}
