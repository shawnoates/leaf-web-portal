"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, use } from "react";
import Parse from "@/lib/parse-client";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
} from "lucide-react";

interface Validation {
  valid: boolean;
  alreadyClaimed?: boolean;
  reason?: string;
  linkedOrgCalendarId?: string | null;
  shareId?: string | null;
  buildingName?: string;
  formattedAddress?: string;
  rmName?: string;
}

// Dual-purpose entry point for the rep's lobby-flyer QR code.
//
// - Building has already been claimed → redirect EVERYONE (RM + residents)
//   to the public calendar at /org/{shareId}.
// - Building NOT yet claimed → show a "pending" page with two clear paths:
//     * "I'm the manager" continues into the RM setup flow.
//     * "I'm a resident" stays and explains the calendar isn't live yet.
//   Residents shouldn't see the RM setup screen by mistake.
export default function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [residentAcknowledged, setResidentAcknowledged] = useState(false);

  useEffect(() => {
    Parse.Cloud.run("validateBuildingClaimToken", { token })
      .then((r: Validation) => {
        setValidation(r);
        if (r.valid && r.alreadyClaimed && r.shareId) {
          window.location.replace(`/org/${r.shareId}`);
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

  if (validation.alreadyClaimed && validation.shareId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-md text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h1 className="mt-4 text-xl font-semibold">
            Taking you to the calendar…
          </h1>
          <Loader2 className="mt-4 w-5 h-5 animate-spin text-zinc-400 mx-auto" />
        </div>
      </div>
    );
  }

  // Building is claimed but no shareId — shouldn't happen often, but render
  // a graceful "pending" view rather than spin forever.
  if (validation.alreadyClaimed && !validation.shareId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-md bg-white border border-zinc-200 rounded-lg p-8 text-center">
          <Clock className="w-10 h-10 text-zinc-400 mx-auto" />
          <h1 className="mt-4 text-xl font-semibold">
            Calendar is being set up
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            {validation.buildingName ?? "This building"}&apos;s calendar is
            almost live. Check back in a few minutes.
          </p>
        </div>
      </div>
    );
  }

  // Not yet claimed — split path.
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-12 flex items-start md:items-center justify-center">
      <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="bg-emerald-700 text-white px-6 py-6">
          <div className="text-[11px] tracking-[0.25em] uppercase font-semibold opacity-90">
            Leaf · Shared calendar
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {validation.buildingName ?? "This building"}
          </h1>
          {validation.formattedAddress && (
            <p className="mt-1 text-sm opacity-90">
              {validation.formattedAddress}
            </p>
          )}
        </div>

        {residentAcknowledged ? (
          <ResidentPendingPanel
            buildingName={validation.buildingName}
            onBack={() => setResidentAcknowledged(false)}
          />
        ) : (
          <RoleChooser
            token={token}
            onResidentSelected={() => setResidentAcknowledged(true)}
          />
        )}
      </div>
    </div>
  );
}

function RoleChooser({
  token,
  onResidentSelected,
}: {
  token: string;
  onResidentSelected: () => void;
}) {
  return (
    <div className="p-6 space-y-4">
      <p className="text-sm text-zinc-700">
        This calendar isn&apos;t live yet — it&apos;s waiting on a manager to
        claim it. Who are you?
      </p>

      <a
        href={`/organizations/setup?claim=${encodeURIComponent(token)}`}
        className="block bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg px-5 py-4"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <div className="text-base font-semibold">
              I&apos;m the manager
            </div>
            <div className="text-xs opacity-90 mt-0.5">
              Claim the calendar for your building — takes about 30 seconds.
            </div>
          </div>
        </div>
      </a>

      <button
        onClick={onResidentSelected}
        className="block w-full text-left bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg px-5 py-4"
      >
        <div className="flex items-start gap-3">
          <Building2 className="w-5 h-5 mt-0.5 text-zinc-600 shrink-0" />
          <div>
            <div className="text-base font-semibold text-zinc-900">
              I&apos;m a resident
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              See what to do until the calendar launches.
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

function ResidentPendingPanel({
  buildingName,
  onBack,
}: {
  buildingName?: string;
  onBack: () => void;
}) {
  return (
    <div className="p-6 space-y-4">
      <Clock className="w-10 h-10 text-zinc-400" />
      <div>
        <h2 className="text-lg font-semibold">Calendar pending</h2>
        <p className="text-sm text-zinc-600 mt-1 leading-relaxed">
          {buildingName ?? "Your building"}&apos;s calendar isn&apos;t live
          yet. Ask your building manager to claim it — they should have an
          email from Leaf, or they can scan the same QR code you did and
          select <strong>I&apos;m the manager</strong>.
        </p>
        <p className="text-sm text-zinc-600 mt-3 leading-relaxed">
          Once it&apos;s live, you&apos;ll be able to RSVP to building events,
          see local deals from nearby businesses, and host your own meetups.
        </p>
      </div>
      <button
        onClick={onBack}
        className="text-xs text-zinc-500 underline hover:text-zinc-900"
      >
        ← Back
      </button>
    </div>
  );
}
