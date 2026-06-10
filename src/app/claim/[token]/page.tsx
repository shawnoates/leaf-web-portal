"use client";

import { useEffect, useState, use } from "react";
import Parse from "@/lib/parse-client";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface Validation {
  valid: boolean;
  alreadyClaimed?: boolean;
  reason?: string;
  leadId?: string;
  buildingName?: string;
  formattedAddress?: string;
  unitCount?: number;
  rmName?: string;
  rmEmail?: string;
  repName?: string;
  linkedOrgCalendarId?: string | null;
}

export default function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [loading, setLoading] = useState(true);
  const [authedEmail, setAuthedEmail] = useState<string | null>(null);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [password, setPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    Parse.Cloud.run("validateBuildingClaimToken", { token })
      .then((r: Validation) => setValidation(r))
      .catch(() =>
        setValidation({ valid: false, reason: "validation_failed" })
      )
      .finally(() => setLoading(false));
    const current = Parse.User.current();
    if (current) {
      setAuthedEmail(
        (current.get("email") || current.get("username") || "").toLowerCase()
      );
    }
  }, [token]);

  useEffect(() => {
    if (validation?.rmName) setSignupName(validation.rmName);
  }, [validation]);

  const expectedEmail = (validation?.rmEmail || "").toLowerCase();
  const emailMatches = authedEmail !== null && authedEmail === expectedEmail;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await Parse.User.logIn(expectedEmail, password);
      setAuthedEmail(expectedEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const u = new Parse.User();
      u.set("username", expectedEmail);
      u.set("email", expectedEmail);
      u.set("password", password);
      u.set("full_name", signupName || expectedEmail);
      await u.signUp();
      setAuthedEmail(expectedEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setSubmitting(false);
    }
  };

  const completeClaim = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await Parse.Cloud.run("completeBuildingClaim", { token });
      setClaimed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!validation?.valid) {
    return (
      <CenteredCard>
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h1 className="mt-4 text-xl font-semibold text-center">
          This link is no longer valid
        </h1>
        <p className="mt-2 text-sm text-zinc-600 text-center">
          {validation?.reason === "token_expired"
            ? "Claim links expire after 60 days. Reach out to the rep who shared it."
            : "This link doesn't match a building we know about."}
        </p>
      </CenteredCard>
    );
  }

  if (validation.alreadyClaimed || claimed) {
    return (
      <CenteredCard>
        <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
        <h1 className="mt-4 text-xl font-semibold text-center">
          {validation.buildingName} is claimed
        </h1>
        <p className="mt-2 text-sm text-zinc-600 text-center">
          You&apos;re the resident manager. Open your calendar to invite
          residents.
        </p>
        {validation.linkedOrgCalendarId && (
          <a
            href={`/org/${validation.linkedOrgCalendarId}`}
            className="mt-6 block text-center bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium px-4 py-3 rounded-md"
          >
            Open calendar
          </a>
        )}
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-emerald-700 font-medium">
          {validation.repName ? `${validation.repName} sent this` : "Leaf"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Claim {validation.buildingName}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {validation.formattedAddress}
        </p>
      </div>

      <div className="mt-6 bg-zinc-50 border border-zinc-200 rounded-md p-4 text-sm space-y-2">
        <Row label="Building">
          {validation.buildingName} ({validation.unitCount} units)
        </Row>
        <Row label="Resident manager">{validation.rmName}</Row>
        <Row label="Sent to">{validation.rmEmail}</Row>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      {emailMatches ? (
        <button
          onClick={completeClaim}
          disabled={submitting}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-300 text-white text-sm font-medium px-4 py-3 rounded-md"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Claim this building
        </button>
      ) : authedEmail && !emailMatches ? (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded">
          <p>
            You&apos;re signed in as <strong>{authedEmail}</strong>. This claim
            link was sent to <strong>{expectedEmail}</strong>.
          </p>
          <button
            onClick={async () => {
              await Parse.User.logOut();
              setAuthedEmail(null);
            }}
            className="mt-2 text-xs underline"
          >
            Sign out and continue
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 py-2 rounded ${
                mode === "signin"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700"
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 rounded ${
                mode === "signup"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700"
              }`}
            >
              Create account
            </button>
          </div>

          <form
            onSubmit={mode === "signin" ? handleSignIn : handleSignUp}
            className="space-y-3"
          >
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Your name
                </label>
                <input
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:border-emerald-600"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Email
              </label>
              <input
                type="email"
                value={expectedEmail}
                readOnly
                className="w-full px-3 py-2 border border-zinc-300 rounded text-sm bg-zinc-50 text-zinc-500"
              />
              <p className="text-xs text-zinc-400 mt-1">
                This claim is tied to the email it was sent to.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-300 text-white text-sm font-medium px-4 py-3 rounded-md"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      )}
    </CenteredCard>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-lg p-8">
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <span className="w-36 text-zinc-500 shrink-0">{label}</span>
      <span className="text-zinc-900">{children}</span>
    </div>
  );
}
