"use client";

import { useState } from "react";
import Parse from "@/lib/parse-client";
import JoinChatPicker from "@/components/JoinChatPicker";
import {
  setVerifiedUserCookie,
  getVerifiedUserCookie,
} from "@/lib/verified-user";
import {
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Phone,
  X,
} from "lucide-react";

type Props = {
  eventGroupId: string;
  planTitle: string;
  planDescription: string;
  expiryDate: string | null;
  location: { name: string; address: string } | null;
  requireApproval: boolean;
};

// Mirror of buildIcsHref in org/[shareId]/page.tsx — keeps the standalone
// landing decoupled from that page. Both call /api/ics with the same params.
function buildIcsHref(opts: {
  uid: string;
  title: string;
  dateISO: string;
  description?: string;
  locationName?: string | null;
  locationAddress?: string | null;
  url?: string;
}): string | null {
  if (Number.isNaN(new Date(opts.dateISO).getTime())) return null;
  const sp = new URLSearchParams();
  sp.set("uid", opts.uid);
  sp.set("title", opts.title);
  sp.set("dateISO", opts.dateISO);
  if (opts.description) sp.set("description", opts.description);
  if (opts.locationName) sp.set("locationName", opts.locationName);
  if (opts.locationAddress) sp.set("locationAddress", opts.locationAddress);
  if (opts.url) sp.set("url", opts.url);
  return `/api/ics?${sp.toString()}`;
}

function formatPhoneNumber(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function StandalonePlanRsvp({
  eventGroupId,
  planTitle,
  planDescription,
  expiryDate,
  location,
  requireApproval,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="block w-full text-center bg-zinc-900 text-white rounded-full py-3 text-sm font-medium hover:bg-zinc-800 transition"
      >
        {requireApproval ? "Request to Attend" : "I’m Attending"}
      </button>
      {open ? (
        <RsvpModal
          eventGroupId={eventGroupId}
          planTitle={planTitle}
          planDescription={planDescription}
          expiryDate={expiryDate}
          location={location}
          requireApproval={requireApproval}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function RsvpModal({
  eventGroupId,
  planTitle,
  planDescription,
  expiryDate,
  location,
  requireApproval,
  onClose,
}: {
  eventGroupId: string;
  planTitle: string;
  planDescription: string;
  expiryDate: string | null;
  location: { name: string; address: string } | null;
  requireApproval: boolean;
  onClose: () => void;
}) {
  const cached = getVerifiedUserCookie();
  const [name, setName] = useState(cached?.name ?? "");
  const [phone, setPhone] = useState(cached?.phone ?? "");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code" | "verified">(
    cached ? "verified" : "phone"
  );
  const [formStep, setFormStep] = useState<"form" | "submitting" | "success" | "error">("form");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [rsvpNote, setRsvpNote] = useState("");
  const [sharePhone, setSharePhone] = useState(true);
  const [isPendingResult, setIsPendingResult] = useState(false);

  const isVerified = step === "verified";

  const sendOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Please enter a valid phone number.");
      return;
    }
    setSending(true);
    setError("");
    try {
      await Parse.Cloud.run("requestOTP", { phone: `+1${digits}` });
      setStep("code");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setSending(false);
    }
  };

  const verifyOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    setSending(true);
    setError("");
    try {
      const result = (await Parse.Cloud.run("verifyOTP", {
        phone: `+1${digits}`,
        code,
      })) as { sessionToken?: string } | null | undefined;
      if (result && result.sessionToken) {
        setStep("verified");
        setVerifiedUserCookie(name, phone);
      } else {
        setError("Invalid code. Please try again.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified) return;
    setFormStep("submitting");
    try {
      const result = (await Parse.Cloud.run("rsvpToPlanViaWeb", {
        phoneNumber: phone.replace(/\D/g, ""),
        name,
        eventGroupId,
        rsvpNote: requireApproval && rsvpNote.trim() ? rsvpNote.trim() : undefined,
        sharePhoneWithHost: sharePhone,
      })) as { pendingApproval?: boolean } | null | undefined;
      setVerifiedUserCookie(name, phone);
      if (result?.pendingApproval) setIsPendingResult(true);
      setFormStep("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to RSVP. Please try again.");
      setFormStep("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-8 md:p-12 relative my-0 md:my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900"
        >
          <X className="w-5 h-5" />
        </button>

        {formStep === "form" || formStep === "submitting" ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-light tracking-tight">
                {requireApproval ? "Request to Attend" : "RSVP for"} {planTitle}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs tracking-wider uppercase font-bold">Your Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  disabled={isVerified}
                  className="w-full border-b border-zinc-300 py-3 text-lg font-light focus:outline-none focus:border-zinc-900 transition-colors disabled:text-zinc-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs tracking-wider uppercase font-bold">Phone Number</label>
                {step === "phone" ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center flex-1 border-b border-zinc-300 focus-within:border-zinc-900 transition-colors">
                      <Phone className="w-4 h-4 text-zinc-400 mr-2" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                        placeholder="555-555-5555"
                        className="w-full py-3 text-lg font-light focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={sendOTP}
                      disabled={sending || phone.replace(/\D/g, "").length < 10 || !name}
                      className="px-4 py-2.5 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {sending ? "Sending..." : "Verify"}
                    </button>
                  </div>
                ) : null}
                {step === "code" ? (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">Enter the 6-digit code sent to {phone}</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="000000"
                        className="flex-1 border-b border-zinc-300 py-3 text-lg font-light tracking-[0.5em] text-center focus:outline-none focus:border-zinc-900 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={verifyOTP}
                        disabled={sending || code.length < 6}
                        className="px-4 py-2.5 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {sending ? "Checking..." : "Confirm"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("phone");
                        setCode("");
                        setError("");
                      }}
                      className="text-xs text-zinc-400 hover:text-zinc-900 underline"
                    >
                      Change number
                    </button>
                  </div>
                ) : null}
                {step === "verified" ? (
                  <div className="flex items-center gap-2 py-3">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm text-emerald-600 font-medium">{phone} verified</span>
                  </div>
                ) : null}
                {error ? <p className="text-xs text-red-500 mt-1">{error}</p> : null}
              </div>
              {isVerified ? (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sharePhone}
                    onChange={(e) => setSharePhone(e.target.checked)}
                    className="w-4 h-4 accent-zinc-900 rounded"
                  />
                  <span className="text-xs text-zinc-600">Share phone number with host</span>
                </label>
              ) : null}
              {requireApproval ? (
                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">
                    Note for the host (optional)
                  </label>
                  <textarea
                    value={rsvpNote}
                    onChange={(e) => setRsvpNote(e.target.value)}
                    maxLength={200}
                    rows={2}
                    className="w-full border border-zinc-200 rounded-lg p-3 text-sm font-light focus:outline-none focus:border-zinc-400 resize-none"
                    placeholder="Tell the host a bit about yourself..."
                  />
                  <p className="text-xs text-zinc-400 text-right mt-0.5">{rsvpNote.length}/200</p>
                </div>
              ) : null}
              <button
                type="submit"
                disabled={formStep === "submitting" || !isVerified || !name}
                className="w-full bg-zinc-900 text-white py-3.5 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50 rounded-lg"
              >
                {formStep === "submitting" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : requireApproval ? (
                  <>Submit Request <ArrowRight className="w-4 h-4" /></>
                ) : (
                  <>Confirm RSVP <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </div>
        ) : formStep === "error" ? (
          <div className="py-8 text-center space-y-6">
            <p className="text-red-600 text-sm">{errorMsg}</p>
            <button
              onClick={() => setFormStep("form")}
              className="text-sm text-zinc-500 hover:text-zinc-900 underline"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="py-6 text-center space-y-5">
            <div
              className={`w-14 h-14 border ${isPendingResult ? "border-amber-500" : "border-zinc-900"} rounded-full flex items-center justify-center mx-auto`}
            >
              {isPendingResult ? (
                <Clock className="w-7 h-7 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-7 h-7" />
              )}
            </div>
            <div>
              <h4 className="text-2xl font-light mb-2">
                {isPendingResult ? "Request Sent!" : "You’re in!"}
              </h4>
              <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                {isPendingResult
                  ? "You’ll receive a text when your request is approved."
                  : "We’ve sent a confirmation text. Open Leaf to chat with the host."}
              </p>
            </div>
            <button onClick={onClose} className="text-sm text-zinc-400 hover:text-zinc-900">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
