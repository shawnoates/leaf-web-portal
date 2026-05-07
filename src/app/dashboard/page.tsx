"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { Calendar } from "lucide-react";
import { getRandomStreakQuote, type StreakQuote } from "@/lib/streak-quotes";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<Parse.User | null>(null);
  const [hasOrg, setHasOrg] = useState(false);
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
      const organizations = result.organizations || [];
      // Single-org model: redirect straight into the user's organization.
      if (organizations.length > 0) {
        setHasOrg(true);
        router.push(`/dashboard/${organizations[0].objectId}`);
        return;
      }
      // New user with no org — send straight to setup
      router.push("/organizations/setup");
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

  // Signed in: either loading, redirecting to the user's org, or showing the empty state.
  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-4xl mx-auto px-6 py-10">
        {loading || hasOrg ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
          </div>
        )}
      </main>
    </div>
  );
}
