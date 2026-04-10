"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { Calendar, Sparkles } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<Parse.User | null>(null);
  const [hasOrg, setHasOrg] = useState(false);
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
    fetchOrg();
  }, [user]);

  async function fetchOrg() {
    setLoading(true);
    try {
      const result = await Parse.Cloud.run("getMyOrganizations");
      const organizations = result.organizations || [];
      // Single-org model: redirect straight into the user's organization.
      if (organizations.length > 0) {
        setHasOrg(true);
        router.push(`/dashboard/${organizations[0].objectId}`);
        return;
      }
    } catch (error) {
      console.error("Failed to fetch organization:", error);
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

  // Signed in: either loading, redirecting to the user's org, or showing the empty state.
  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-4xl mx-auto px-6 py-10">
        {loading || hasOrg ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
          </div>
        ) : (
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
        )}
      </main>
    </div>
  );
}
