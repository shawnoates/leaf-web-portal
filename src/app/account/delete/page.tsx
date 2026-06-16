"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Parse from "@/lib/parse-client";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Loader2,
  XCircle,
} from "lucide-react";

const REASONS: [string, string, string][] = [
  ["not_using", "I'm not using it anymore", "Just doesn't fit my life right now."],
  ["too_many_notifications", "Too many notifications", "Volume / frequency was too much."],
  ["privacy_concerns", "Privacy concerns", "I'd rather not have an account here."],
  ["found_alternative", "Found a better alternative", "Using a different tool now."],
  ["bugs_or_broken", "Bugs or didn't work right", "Things were broken or unreliable."],
  ["too_expensive", "Too expensive", "Pricing didn't work for us."],
  ["other", "Other", "Tell us in your own words."],
];

interface SessionUser {
  email: string;
  displayName: string;
  ownedCalendarsCount?: number;
}

export default function DeleteAccountPage() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [reason, setReason] = useState<string>("not_using");
  const [notes, setNotes] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [stage, setStage] = useState<"form" | "confirm" | "done">("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = Parse.User.current();
    if (!u) {
      router.replace("/organizations/setup?next=/account/delete");
      return;
    }
    setSessionUser({
      email: u.get("email") || u.get("username") || "",
      displayName: u.get("full_name") || u.get("name") || u.get("email") || "",
    });
    setLoading(false);
  }, [router]);

  const submit = async () => {
    setError(null);
    if (reason === "other" && !notes.trim()) {
      setError("Tell us a bit about why — it's required when reason is 'Other'.");
      return;
    }
    if (
      confirmEmail.trim().toLowerCase() !==
      (sessionUser?.email || "").toLowerCase()
    ) {
      setError("Email confirmation doesn't match the account email.");
      return;
    }
    setSubmitting(true);
    try {
      await Parse.Cloud.run("deleteMyAccount", {
        reason,
        notes: notes.trim() || undefined,
        source: "web",
      });
      await Parse.User.logOut().catch(() => {
        /* server already invalidated sessions; ignore */
      });
      try {
        localStorage.clear();
      } catch {
        /* ignore quota / privacy errors */
      }
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete account");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !sessionUser) {
    return (
      <Centered>
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </Centered>
    );
  }

  if (stage === "done") {
    return (
      <Centered>
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
          <Check className="w-10 h-10 text-emerald-700" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Your account has been deleted.
        </h1>
        <p className="text-sm text-zinc-500 mt-3 text-center max-w-sm">
          Thanks for trying Leaf. If you ever want to come back, just sign up
          again with a new account.
        </p>
        <Link
          href="/"
          className="mt-6 px-5 py-2 bg-zinc-900 text-white text-xs uppercase tracking-widest font-bold rounded-lg"
        >
          Done
        </Link>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 flex items-start md:items-center justify-center">
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm w-full max-w-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] tracking-wider uppercase font-bold text-zinc-500">
              Account settings
            </p>
            <h1 className="text-base font-semibold tracking-tight">
              Delete your account
            </h1>
          </div>
        </div>

        {stage === "form" && (
          <div className="px-6 py-5 space-y-5">
            <p className="text-sm text-zinc-600 leading-relaxed">
              Signed in as{" "}
              <strong className="text-zinc-900">{sessionUser.email}</strong>. If
              you still own any calendars, delete or transfer those first from
              the dashboard — we&apos;ll refuse the delete otherwise so they
              don&apos;t end up orphaned.
            </p>

            <div>
              <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 mb-2">
                Reason
              </p>
              <div className="space-y-2">
                {REASONS.map(([value, label, hint]) => (
                  <label
                    key={value}
                    className={`flex items-start gap-3 p-3 border rounded cursor-pointer ${
                      reason === value
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={value}
                      checked={reason === value}
                      onChange={() => setReason(value)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{hint}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-500">
                Notes{reason === "other" ? " (required)" : " (optional)"}
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Tell us what could have been better."
                className="mt-1 w-full px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:border-zinc-900 bg-white"
              />
            </label>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              <Link
                href="/"
                className="text-sm text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Cancel
              </Link>
              <button
                onClick={() => {
                  setError(null);
                  if (reason === "other" && !notes.trim()) {
                    setError(
                      "Tell us a bit about why — it's required when reason is 'Other'."
                    );
                    return;
                  }
                  setStage("confirm");
                }}
                className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold uppercase tracking-widest px-4 py-2 rounded-lg"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {stage === "confirm" && (
          <div className="px-6 py-5 space-y-5">
            <div className="p-4 bg-red-50 border border-red-200 rounded space-y-2">
              <p className="text-sm font-semibold text-red-800 inline-flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                This can&apos;t be undone.
              </p>
              <ul className="text-xs text-red-700 space-y-1 ml-6 list-disc">
                <li>Your name, email, and photo will be removed.</li>
                <li>Any active paid subscription on your account will be cancelled.</li>
                <li>Past plans + RSVPs stay, but show no name attached to you.</li>
                <li>Signing back in won&apos;t restore access.</li>
              </ul>
            </div>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-500">
                Type your email to confirm
              </span>
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={sessionUser.email}
                autoComplete="off"
                className="mt-1 w-full px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:border-red-600 bg-white"
              />
            </label>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                onClick={() => setStage("form")}
                disabled={submitting}
                className="text-sm text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1 disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={submit}
                disabled={
                  submitting ||
                  confirmEmail.trim().toLowerCase() !==
                    sessionUser.email.toLowerCase()
                }
                className="inline-flex items-center gap-2 bg-red-700 hover:bg-red-800 disabled:bg-red-300 text-white text-sm font-bold uppercase tracking-widest px-4 py-2 rounded-lg"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete my account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-6">
      {children}
    </div>
  );
}
