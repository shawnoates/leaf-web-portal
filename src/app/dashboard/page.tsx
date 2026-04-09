"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { Plus, Calendar, Users, ChevronRight, Sparkles } from "lucide-react";

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

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  starter: { label: "Starter", color: "bg-zinc-100 text-zinc-600" },
  growth: { label: "Growth", color: "bg-emerald-50 text-emerald-700" },
  pro: { label: "Pro", color: "bg-violet-50 text-violet-700" },
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<Parse.User | null>(null);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

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
    fetchOrgs();
  }, [user]);

  async function fetchOrgs() {
    setLoading(true);
    try {
      const result = await Parse.Cloud.run("getMyOrganizations");
      const organizations = result.organizations || [];
      setOrgs(organizations);
      // Single-org model: if user has exactly one org, go directly to it
      if (organizations.length === 1) {
        router.push(`/dashboard/${organizations[0].objectId}`);
        return;
      }
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
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
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full text-center">
          <Calendar className="w-10 h-10 mx-auto mb-4 text-zinc-400" />
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
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-zinc-100">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-light tracking-tight">
              My Organization
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Manage your calendars, plans, and subscriptions.
            </p>
          </div>
          {orgs.length === 0 && !loading && (
            <Link
              href="/organizations/setup"
              className="flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-lg"
            >
              <Plus className="w-4 h-4" />
              New Organization
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
          </div>
        ) : orgs.length === 0 ? (
          <div className="text-center py-20">
            <Sparkles className="w-10 h-10 mx-auto mb-4 text-zinc-300" />
            <h2 className="text-xl font-light tracking-tight mb-2">
              No organization yet
            </h2>
            <p className="text-sm text-zinc-500 mb-6 max-w-xs mx-auto">
              Create your organization to start generating AI-powered plan ideas for your community.
            </p>
            <Link
              href="/organizations/setup"
              className="inline-flex items-center gap-2 bg-zinc-900 text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-lg"
            >
              Create Organization
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orgs.map((org) => {
              const tierInfo = TIER_LABELS[org.tier] || TIER_LABELS.starter;
              return (
                <Link
                  key={org.objectId}
                  href={`/dashboard/${org.objectId}`}
                  className="block border border-zinc-200 rounded-xl p-6 hover:border-zinc-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-lg font-medium tracking-tight truncate">
                          {org.name}
                        </h2>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${tierInfo.color}`}
                        >
                          {tierInfo.label}
                        </span>
                      </div>
                      {org.description && (
                        <p className="text-sm text-zinc-500 line-clamp-1 mb-3">
                          {org.description}
                        </p>
                      )}
                      <div className="flex items-center gap-5 text-xs text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {org.memberCount} members
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {org.calendarCount} {org.calendarCount === 1 ? "calendar" : "calendars"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          {org.upcomingPlanCount} upcoming
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-zinc-500 transition-colors shrink-0 mt-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
