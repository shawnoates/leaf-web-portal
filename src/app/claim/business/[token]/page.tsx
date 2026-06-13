"use client";

import { use, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import {
  AlertTriangle,
  Check,
  Loader2,
  MapPin,
  Phone,
  Store,
  X,
  XCircle,
} from "lucide-react";

interface ClaimStatus {
  objectId: string;
  name: string;
  formattedAddress: string | null;
  phoneMasked: string | null;
  category: string | null;
  claimed: boolean;
  claimedAt: string | null;
  claimTokenExpiresAt: string | null;
  ivrCodeExpiresAt: string | null;
  ivrAttempts: number;
  claimReviewRequested: boolean;
  claimReviewedAt: string | null;
}

export default function ClaimBusinessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [status, setStatus] = useState<ClaimStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewImageUrl, setReviewImageUrl] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const load = async () => {
    try {
      const r: ClaimStatus = await Parse.Cloud.run("getBusinessClaimStatus", {
        token,
      });
      setStatus(r);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load claim");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const verify = async () => {
    setVerifyError(null);
    setVerifying(true);
    try {
      const r: ClaimStatus = await Parse.Cloud.run("verifyBusinessClaim", {
        token,
        code: code.trim(),
        claimerName: name.trim() || undefined,
        claimerEmail: email.trim().toLowerCase() || undefined,
      });
      setStatus(r);
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const submitReview = async () => {
    setReviewError(null);
    setReviewSubmitting(true);
    try {
      const r: ClaimStatus = await Parse.Cloud.run(
        "requestBusinessClaimReview",
        {
          token,
          evidenceImageUrl: reviewImageUrl.trim() || undefined,
          notes: reviewNotes.trim() || undefined,
        }
      );
      setStatus(r);
      setReviewOpen(false);
    } catch (e) {
      setReviewError(
        e instanceof Error ? e.message : "Could not submit review request"
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <Centered>
        <XCircle className="w-12 h-12 text-red-500" />
        <h1 className="text-xl font-semibold mt-4">Claim link not valid</h1>
        <p className="text-sm text-zinc-500 mt-2 text-center max-w-xs">
          {loadError}
        </p>
        <p className="text-xs text-zinc-400 mt-4 text-center max-w-xs">
          Ask the Leaf rep you spoke with to generate a new link.
        </p>
      </Centered>
    );
  }
  if (!status) {
    return (
      <Centered>
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </Centered>
    );
  }

  if (status.claimed) {
    return (
      <Centered>
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
          <Check className="w-10 h-10 text-emerald-700" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {status.name} is claimed
        </h1>
        <p className="text-sm text-zinc-500 mt-2 text-center max-w-sm">
          You can now post real-time deals to nearby residents. We&apos;ll email
          you sign-in instructions shortly.
        </p>
        <div className="mt-6 bg-white border border-zinc-200 rounded-xl p-5 max-w-sm w-full text-sm">
          <Row label="Business">{status.name}</Row>
          {status.formattedAddress && (
            <Row label="Address">{status.formattedAddress}</Row>
          )}
          {status.claimedAt && (
            <Row label="Claimed">
              {new Date(status.claimedAt).toLocaleString()}
            </Row>
          )}
        </div>
      </Centered>
    );
  }

  if (status.claimReviewRequested && !status.claimReviewedAt) {
    return (
      <Centered>
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-5">
          <AlertTriangle className="w-8 h-8 text-amber-700" />
        </div>
        <h1 className="text-xl font-semibold">Manual review submitted</h1>
        <p className="text-sm text-zinc-500 mt-2 text-center max-w-sm">
          Thanks. A Leaf admin will look at your evidence and reach out within
          a business day.
        </p>
      </Centered>
    );
  }

  const codeExpired =
    status.ivrCodeExpiresAt !== null &&
    new Date(status.ivrCodeExpiresAt).getTime() < Date.now();

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 flex items-center justify-center">
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm w-full max-w-md overflow-hidden">
        <div className="bg-zinc-100 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white border border-zinc-200 flex items-center justify-center">
            <Store className="w-5 h-5 text-zinc-700" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] tracking-wider uppercase font-bold text-zinc-500">
              Claim your listing
            </p>
            <p className="font-semibold truncate">{status.name}</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {status.formattedAddress && (
            <div className="flex items-start gap-2 text-sm text-zinc-700">
              <MapPin className="w-4 h-4 mt-0.5 text-zinc-400 shrink-0" />
              <span>{status.formattedAddress}</span>
            </div>
          )}

          {codeExpired ? (
            <Banner tone="error">
              The verification code expired. Ask the Leaf rep to re-call —
              we&apos;ll generate a fresh code (link stays the same).
            </Banner>
          ) : (
            <Banner tone="info">
              <strong>We&apos;re calling{status.phoneMasked ? ` ${status.phoneMasked}` : " your business"}.</strong>{" "}
              Pick up and listen for a 6-digit code, then enter it below.
            </Banner>
          )}

          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-500">
                Verification code
              </span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                disabled={codeExpired}
                className="mt-1 w-full px-3 py-3 border border-zinc-300 rounded text-lg tracking-[0.5em] text-center focus:outline-none focus:border-zinc-900 bg-white disabled:bg-zinc-100"
              />
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-500">
                Your name
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="mt-1 w-full px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:border-zinc-900 bg-white"
              />
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-500">
                Your email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                className="mt-1 w-full px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:border-zinc-900 bg-white"
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                Where we send sign-in instructions + receipts.
              </p>
            </label>
          </div>

          {verifyError && (
            <Banner tone="error">{verifyError}</Banner>
          )}

          <button
            onClick={verify}
            disabled={
              verifying || code.length < 6 || !email.trim() || codeExpired
            }
            className="w-full inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white text-sm font-bold uppercase tracking-widest px-4 py-3 rounded-lg"
          >
            {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
            Verify & claim
          </button>

          {status.ivrAttempts > 0 && (
            <p className="text-[11px] text-amber-700 text-center">
              {status.ivrAttempts} failed attempt
              {status.ivrAttempts === 1 ? "" : "s"} so far.
            </p>
          )}

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="text-xs text-zinc-500 underline hover:text-zinc-900"
            >
              Didn&apos;t get the call? Request manual review
            </button>
          </div>
        </div>
      </div>

      {reviewOpen && (
        <ReviewModal
          imageUrl={reviewImageUrl}
          setImageUrl={setReviewImageUrl}
          notes={reviewNotes}
          setNotes={setReviewNotes}
          submitting={reviewSubmitting}
          error={reviewError}
          onCancel={() => {
            setReviewOpen(false);
            setReviewError(null);
          }}
          onSubmit={submitReview}
        />
      )}
    </div>
  );
}

function ReviewModal({
  imageUrl,
  setImageUrl,
  notes,
  setNotes,
  submitting,
  error,
  onCancel,
  onSubmit,
}: {
  imageUrl: string;
  setImageUrl: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold">Request manual review</h2>
          <button onClick={onCancel} className="p-1 text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-zinc-600 leading-relaxed">
            Upload a photo of your business license, a current utility bill, or
            a business card — anything that proves ownership. A Leaf admin will
            review within a business day.
          </p>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-500">
              Image URL
            </span>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:border-zinc-900 bg-white"
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              Upload to imgur, Dropbox, or any public host and paste the link.
            </p>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-500">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything else we should know"
              className="mt-1 w-full px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:border-zinc-900 bg-white"
            />
          </label>
          {error && <Banner tone="error">{error}</Banner>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-100 bg-zinc-50">
          <button
            onClick={onCancel}
            className="text-sm text-zinc-500 px-3 py-2 hover:text-zinc-900"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || (!imageUrl.trim() && !notes.trim())}
            className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white text-sm font-bold uppercase tracking-widest px-4 py-2 rounded-lg"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit
          </button>
        </div>
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

function Banner({
  tone,
  children,
}: {
  tone: "info" | "error";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "bg-red-50 border border-red-200 text-red-700"
      : "bg-zinc-100 border border-zinc-200 text-zinc-700";
  const Icon = tone === "error" ? XCircle : Phone;
  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${cls}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-1">
      <dt className="w-24 shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-zinc-900 flex-1">{children}</dd>
    </div>
  );
}
