"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, use } from "react";
import Parse from "@/lib/parse-client";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface Validation {
  valid: boolean;
  alreadyClaimed?: boolean;
  reason?: string;
  linkedOrgCalendarId?: string | null;
  buildingName?: string;
}

export default function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [validation, setValidation] = useState<Validation | null>(null);

  useEffect(() => {
    Parse.Cloud.run("validateBuildingClaimToken", { token })
      .then((r: Validation) => {
        setValidation(r);
        if (r.valid && !r.alreadyClaimed) {
          // Redirect to the setup flow which handles auth + calendar creation
          // + completing the claim atomically.
          window.location.replace(
            `/organizations/setup?claim=${encodeURIComponent(token)}`
          );
        } else if (r.valid && r.alreadyClaimed && r.linkedOrgCalendarId) {
          // Already claimed — go to the calendar
          window.location.replace(`/dashboard/${r.linkedOrgCalendarId}`);
        }
      })
      .catch(() =>
        setValidation({ valid: false, reason: "validation_failed" })
      );
  }, [token]);

  if (!validation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!validation.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-md bg-white border border-zinc-200 rounded-lg p-8 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="mt-4 text-xl font-semibold">
            This link is no longer valid
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            {validation.reason === "token_expired"
              ? "Claim links expire after 60 days. Reach out to the Leaf rep who shared it."
              : "We couldn't find this claim. Reach out to the Leaf rep who shared it."}
          </p>
        </div>
      </div>
    );
  }

  // Valid + redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
        <h1 className="mt-4 text-xl font-semibold">
          Taking you to setup…
        </h1>
        <Loader2 className="mt-4 w-5 h-5 animate-spin text-zinc-400 mx-auto" />
      </div>
    </div>
  );
}
