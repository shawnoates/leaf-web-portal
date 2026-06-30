"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Parse from "@/lib/parse-client";
import { AlertCircle, CheckCircle2, Loader2, Store } from "lucide-react";

// Minimal partner-portal landing page for the merchant-claim email link
// (`/business/setup?claim=<token>`). v1 validates the token and prefills the
// business info so the merchant sees their listing immediately — the full
// "create your account / claim listing" submit flow lands as Phase 2 once
// the merchant auth model + acceptBusinessLeadClaim cloud fn are wired up.
//
// If `claim` is missing this page renders a generic "claim or sign in" stub
// rather than throwing — the same page can later host both the rep-driven
// link and an unguided merchant entry point.

interface ClaimInfo {
  valid: boolean;
  alreadyClaimed?: boolean;
  reason?: string;
  linkedBusinessId?: string | null;
  businessName?: string | null;
  formattedAddress?: string | null;
  category?: string | null;
  phone?: string | null;
  website?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  googlePlaceId?: string | null;
}

export default function BusinessSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      }
    >
      <BusinessSetupInner />
    </Suspense>
  );
}

function BusinessSetupInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("claim");
  const [claim, setClaim] = useState<ClaimInfo | null>(null);

  useEffect(() => {
    if (!token) {
      setClaim({ valid: false, reason: "no_token" });
      return;
    }
    Parse.Cloud.run("validateBusinessLeadClaimToken", { token })
      .then((r: ClaimInfo) => setClaim(r))
      .catch(() =>
        setClaim({ valid: false, reason: "validation_failed" })
      );
  }, [token]);

  if (!claim) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  // No claim token on the URL — soft landing so a merchant typing the URL
  // directly doesn't see a hard error.
  if (claim.reason === "no_token") {
    return (
      <Shell title="Leaf for Business">
        <p className="text-sm text-zinc-600">
          This is the merchant portal sign-in entry point. Look for the claim
          link in the email from your Leaf rep, or contact us at
          partners@joinleaf.com.
        </p>
      </Shell>
    );
  }

  if (!claim.valid) {
    return (
      <Shell title="This link is no longer valid">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-zinc-700">
              {claim.reason === "token_expired"
                ? "Claim links expire after 60 days. Reach out to the Leaf rep who shared it."
                : "We couldn't find this claim. Reach out to the Leaf rep who shared it."}
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  if (claim.alreadyClaimed) {
    return (
      <Shell title={`${claim.businessName ?? "Your business"} is already claimed`}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-sm text-zinc-700">
            Sign in to manage your listing, deals, and sponsorships.
          </p>
        </div>
        <a
          href="/business"
          className="mt-4 inline-flex items-center justify-center w-full bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-3 rounded-lg"
        >
          Go to your dashboard
        </a>
      </Shell>
    );
  }

  return (
    <Shell title="Claim your business listing">
      <p className="text-sm text-zinc-600 mb-4">
        Your Leaf rep set up a listing for{" "}
        <strong>{claim.businessName}</strong>. Confirm it&apos;s yours and
        you&apos;ll be able to post deals, sponsor events, and track foot
        traffic from nearby residents.
      </p>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <Store className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-emerald-900">
              {claim.businessName}
            </p>
            <p className="text-xs text-emerald-800/80">
              {claim.formattedAddress}
            </p>
            {claim.category && (
              <p className="text-xs text-emerald-700/80 capitalize mt-1">
                Category: {claim.category}
              </p>
            )}
            {claim.phone && (
              <p className="text-xs text-emerald-700/80 mt-0.5">
                Phone: {claim.phone}
              </p>
            )}
            {claim.website && (
              <p className="text-xs text-emerald-700/80 mt-0.5">
                Website: {claim.website}
              </p>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled
        className="mt-5 inline-flex items-center justify-center w-full bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-semibold px-4 py-3 rounded-lg cursor-not-allowed"
        title="Account creation lands in Phase 2 — wire up acceptBusinessLeadClaim and the merchant auth model first."
      >
        Continue — coming soon
      </button>
      <p className="mt-2 text-xs text-zinc-500 text-center">
        Have questions? Reply to the email from your Leaf rep, or write{" "}
        <a
          href="mailto:partners@joinleaf.com"
          className="text-emerald-700 hover:underline"
        >
          partners@joinleaf.com
        </a>
        .
      </p>
    </Shell>
  );
}

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-12 flex items-start md:items-center justify-center">
      <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="bg-emerald-700 text-white px-6 py-6">
          <div className="text-[11px] tracking-[0.25em] uppercase font-semibold opacity-90">
            Leaf · For Business
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {title}
          </h1>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
