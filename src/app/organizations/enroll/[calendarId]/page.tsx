"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { ChevronLeft, Check, Sparkles } from "lucide-react";

interface CalendarInfo {
  id: string;
  name: string;
  tier: "starter" | "pro" | "concierge";
  eligibilityState: string;
  conciergeSubscriptionStatus: string | null;
}

/**
 * Concierge enrollment — Step 1 of 3: plan confirm.
 *
 * Shows upgrade context (Free or Pro → Concierge), pricing, welcome credit,
 * and a CTA that creates the Stripe Checkout Session via Cloud Code and
 * redirects to Stripe.
 *
 * Step 2 (payment) happens on Stripe. Step 3 (intake) lives at
 * /organizations/enroll/[calendarId]/intake, reached after Stripe success.
 */
export default function ConciergeEnrollPage({
  params,
}: {
  params: Promise<{ calendarId: string }>;
}) {
  const { calendarId } = use(params);
  const router = useRouter();

  const [calendar, setCalendar] = useState<CalendarInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Which calendar concierge should run — the org itself or one of its children.
  const [servicedOptions, setServicedOptions] = useState<{ id: string; name: string; image: string | null }[]>([]);
  const [servicedId, setServicedId] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ParseAny = Parse as any;
        const user = ParseAny.User.current();
        if (!user) {
          router.replace(`/dashboard?next=/organizations/enroll/${calendarId}`);
          return;
        }
        const q = new ParseAny.Query("Groups");
        const cal = await q.get(calendarId);
        if (!mounted) return;
        const owner = cal.get("owner");
        if (!owner || owner.id !== user.id) {
          setError("You're not the owner of this calendar.");
          setLoading(false);
          return;
        }
        const info: CalendarInfo = {
          id: cal.id,
          name: cal.get("name") || cal.get("orgName") || "Your calendar",
          tier: cal.get("orgSubscriptionTier") || "starter",
          eligibilityState: cal.get("conciergeEligibilityState") || "not_eligible",
          conciergeSubscriptionStatus: cal.get("conciergeSubscriptionStatus") || null,
        };
        if (!["eligible", "invited", "enrolling"].includes(info.eligibilityState)) {
          setError("This calendar isn't currently eligible for Concierge. Reach out to the Leaf team if you'd like to enroll.");
        }
        if (
          info.conciergeSubscriptionStatus &&
          ["active", "cancelling", "past_due", "paused"].includes(info.conciergeSubscriptionStatus)
        ) {
          // Already enrolled — bounce to dashboard
          router.replace(`/dashboard/${calendarId}`);
          return;
        }
        setCalendar(info);

        // Serviced-calendar options: the org + its child calendars.
        const childQ = new ParseAny.Query("Groups");
        childQ.equalTo("parentOrganization", cal);
        childQ.ascending("createdAt");
        const children = await childQ.find();
        if (mounted) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const imgOf = (g: any): string | null =>
            g.get("profilePhoto")?.url?.() || g.get("group_profile_photo_url") || null;
          const opts = [
            { id: cal.id, name: cal.get("name") || "Primary calendar", image: imgOf(cal) },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...children.map((c: any) => ({
              id: c.id,
              name: c.get("name") || "Calendar",
              image: imgOf(c),
            })),
          ];
          setServicedOptions(opts);
          // Only preselect when there's a single calendar (nothing to choose).
          // With multiple, the owner must actively pick one.
          setServicedId(opts.length === 1 ? cal.id : "");
        }
        setLoading(false);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load calendar.");
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [calendarId, router]);

  const handleContinue = () => {
    // Require an explicit pick when the owner has more than one calendar.
    if (servicedOptions.length > 1 && !servicedId) {
      setError("Pick which calendar Concierge should run.");
      return;
    }
    // Questions come before payment — go to intake; checkout happens at the end.
    // Carry the chosen serviced calendar through to the checkout call.
    setSubmitting(true);
    const serviced = servicedId && servicedId !== calendarId ? `?serviced=${servicedId}` : "";
    router.push(`/organizations/enroll/${calendarId}/intake${serviced}`);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-zinc-500">
        Loading…
      </main>
    );
  }

  if (error && !calendar) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-zinc-700 max-w-md">{error}</p>
        <Link href="/organizations" className="mt-6 text-sm text-zinc-500 underline">
          Back to Organizations
        </Link>
      </main>
    );
  }

  if (!calendar) return null;

  const fromTierLabel =
    calendar.tier === "pro" ? "Pro" : calendar.tier === "concierge" ? "Concierge" : "Free";

  return (
    <main className="min-h-screen bg-zinc-50">
      {/* Progress bar */}
      <div className="border-b bg-white">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-xs tracking-wide font-medium">
            <StepDot active label="Plan" />
            <span className="flex-1 h-px bg-zinc-300 mx-2" />
            <StepDot label="Questions" />
            <span className="flex-1 h-px bg-zinc-300 mx-2" />
            <StepDot label="Pay" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link
          href="/organizations#pricing"
          className="inline-flex items-center text-xs text-zinc-500 hover:text-zinc-900 mb-6"
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
          Back
        </Link>

        <h1 className="text-3xl font-light tracking-tight mb-2">
          Upgrade {calendar.name} to Concierge
        </h1>
        <p className="text-sm text-zinc-500 mb-10">
          A dedicated host to plan, post, and show up for your community — every
          month. You approve the picks, we run them.
        </p>

        <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-8">
          <div className="flex items-baseline gap-4 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">You&apos;re on</span>
            <span className="font-medium">{fromTierLabel}</span>
          </div>
          <div className="flex items-baseline gap-4 text-sm mt-2.5">
            <span className="text-zinc-500 w-24 shrink-0">Upgrading to</span>
            <span className="font-medium">Concierge · $499/mo</span>
          </div>
          {calendar.tier === "pro" && (
            <p className="text-xs text-zinc-500 italic mt-4">
              Concierge includes everything in Pro, plus one free event per month —
              planned and hosted by us for your community.
            </p>
          )}
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-8">
          <p className="text-xs tracking-wider uppercase text-zinc-500 font-semibold mb-3">
            Included
          </p>
          <ul className="space-y-2 text-sm">
            <FeatureLine>One done-for-you event every month — you approve the picks</FeatureLine>
            <FeatureLine>3–4 curated options each month, picked for your community</FeatureLine>
            <FeatureLine>A dedicated concierge, backed by the Leaf OS team</FeatureLine>
            <FeatureLine>Promo kit, RSVPs &amp; vendor coordination handled — standard vendor costs covered by Leaf</FeatureLine>
            <FeatureLine>Cancel anytime — your calendar stays</FeatureLine>
          </ul>
        </div>

        {/* Serviced-calendar picker — only when the org has more than one. */}
        {servicedOptions.length > 1 && (
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-8">
            <span className="text-sm font-medium text-zinc-900">Which calendar should Concierge run?</span>
            <p className="text-xs text-zinc-500 mt-0.5 mb-3">
              Your host plans and hosts one event a month for this calendar. You can change it later.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {servicedOptions.map((o) => {
                const active = servicedId === o.id;
                return (
                  <button
                    type="button"
                    key={o.id}
                    onClick={() => setServicedId(o.id)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                      active ? "border-zinc-900 ring-1 ring-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    {o.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.image} alt={o.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-zinc-300" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-zinc-900 min-w-0 truncate">{o.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* The Leaf OS Guarantee — prominent risk-reversal seal (replaces the
            old welcome-credit framing). Tier 1: first event unconditional;
            Tier 2: make-it-right on every event after. */}
        <div className="border-2 border-emerald-500/40 bg-emerald-50 rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div className="shrink-0 w-24 h-24 rounded-full bg-emerald-600 text-white flex flex-col items-center justify-center text-center leading-none shadow-lg shadow-emerald-600/25 ring-4 ring-emerald-600/15">
            <span className="text-2xl font-extrabold tracking-tight">100%</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] mt-1">Guarantee</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-emerald-900 mb-1.5">The Leaf OS Guarantee</h3>
            <p className="text-sm text-emerald-900/80 leading-relaxed">
              Don&apos;t love your first event? Get that month back, no questions
              asked. And every month after, if an event doesn&apos;t land, we&apos;ll
              make it right. Just tell us within 7 days.
            </p>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-8">
          <div className="flex justify-between text-sm">
            <span>Today&apos;s charge</span>
            <span className="font-medium">$499.00</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">Then $499/mo. Cancel anytime.</p>
        </div>

        {error && (
          <div className="text-sm text-red-600 mb-4 text-center">{error}</div>
        )}

        <button
          onClick={handleContinue}
          disabled={submitting || (servicedOptions.length > 1 && !servicedId)}
          className="w-full bg-zinc-900 text-white font-semibold py-4 rounded-full hover:bg-zinc-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Loading…" : "Continue →"}
        </button>
        <p className="text-center text-xs text-zinc-500 mt-3">
          A few quick questions next — you&apos;ll set up payment at the end.
        </p>
      </div>
    </main>
  );
}

function StepDot({ active, label }: { active?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-2.5 h-2.5 rounded-full ${
          active ? "bg-zinc-900" : "bg-zinc-300"
        }`}
      />
      <span className={active ? "text-zinc-900" : "text-zinc-400"}>{label}</span>
    </div>
  );
}

function FeatureLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-zinc-700">
      <Check className="w-4 h-4 mt-0.5 shrink-0 text-zinc-900" />
      <span>{children}</span>
    </li>
  );
}

// Ensure Sparkles import doesn't get treeshaken if used elsewhere; reference to keep tidy.
void Sparkles;
