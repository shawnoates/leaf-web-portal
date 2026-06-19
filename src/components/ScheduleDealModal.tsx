"use client";

import { useEffect, useMemo, useState } from "react";
import Parse from "@/lib/parse-client";
import {
  getVerifiedUserCookie,
  setVerifiedUserCookie,
} from "@/lib/verified-user";
import { Check, Loader2, Phone, X } from "lucide-react";

interface DealLite {
  objectId: string;
  title: string;
  redeemWindowMinutes: number;
  business: {
    objectId: string;
    name: string;
    formattedAddress: string | null;
  } | null;
}

type VerifyStep = "phone" | "code" | "verified";

const LEAD_TIME_MIN = 30;

function formatPhoneNumber(value: string) {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}

function defaultScheduleDateTime() {
  const d = new Date(Date.now() + 90 * 60 * 1000); // 90 min from now
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toTimeInputValue(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function ScheduleDealModal({
  deal,
  onClose,
  onScheduled,
  brandColor,
}: {
  deal: DealLite;
  onClose: () => void;
  onScheduled: (info: { token: string; scheduledFor: string }) => void;
  brandColor?: string | null;
}) {
  const cached = useMemo(() => getVerifiedUserCookie(), []);

  const initial = useMemo(defaultScheduleDateTime, []);
  const [date, setDate] = useState(toDateInputValue(initial));
  const [time, setTime] = useState(toTimeInputValue(initial));

  const [name, setName] = useState(cached?.name || "");
  const [phone, setPhone] = useState(cached?.phone || "");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<VerifyStep>(cached ? "verified" : "phone");
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    token: string;
    scheduledFor: string;
  } | null>(null);

  const minDateValue = toDateInputValue(new Date());

  const sendOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setOtpError("Enter a valid phone number");
      return;
    }
    if (!name.trim()) {
      setOtpError("Enter your name first");
      return;
    }
    setOtpSending(true);
    setOtpError(null);
    try {
      await Parse.Cloud.run("requestOTP", { phone: `+1${digits}` });
      setStep("code");
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    setOtpSending(true);
    setOtpError(null);
    try {
      const result = await Parse.Cloud.run("verifyOTP", {
        phone: `+1${digits}`,
        code,
      });
      if (result && typeof result === "object" && "sessionToken" in result) {
        setStep("verified");
        setVerifiedUserCookie(name, phone);
      } else {
        setOtpError("Invalid code");
      }
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setOtpSending(false);
    }
  };

  const scheduledForIso = useMemo(() => {
    if (!date || !time) return null;
    const dt = new Date(`${date}T${time}`);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  }, [date, time]);

  const isFutureEnough = useMemo(() => {
    if (!scheduledForIso) return false;
    return (
      new Date(scheduledForIso).getTime() >=
      Date.now() + LEAD_TIME_MIN * 60 * 1000
    );
  }, [scheduledForIso]);

  const canSubmit =
    step === "verified" && isFutureEnough && !submitting && !success;

  const submit = async () => {
    if (!scheduledForIso) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await Parse.Cloud.run("scheduleDealPlan", {
        dealId: deal.objectId,
        scheduledFor: scheduledForIso,
        clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        phone: `+1${phone.replace(/\D/g, "")}`,
        name: name.trim(),
      });
      setSuccess({
        token: result.token,
        scheduledFor: result.scheduledFor,
      });
      onScheduled({ token: result.token, scheduledFor: result.scheduledFor });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Schedule failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Close on ESC.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (success) {
    const dt = new Date(success.scheduledFor);
    return (
      <Frame onClose={onClose} title="You're scheduled">
        <div className="space-y-4 text-center py-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
            <Check className="w-6 h-6 text-emerald-700" />
          </div>
          <p className="text-sm text-zinc-700">
            We&apos;ll text you a redemption link about 15 minutes before{" "}
            <strong>{deal.title}</strong> at{" "}
            <strong>{deal.business?.name ?? "the business"}</strong>.
          </p>
          <p className="text-xs text-zinc-500">
            Scheduled for{" "}
            {dt.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <button
            onClick={onClose}
            className="mt-2 px-5 py-2 text-xs uppercase tracking-widest font-bold rounded-lg text-white"
            style={{ backgroundColor: brandColor || "#18181b" }}
          >
            Done
          </button>
        </div>
      </Frame>
    );
  }

  return (
    <Frame onClose={onClose} title={`Schedule "${deal.title}"`}>
      <div className="space-y-5">
        <p className="text-xs text-zinc-500">
          {deal.business?.name ?? "Local business"}
          {deal.business?.formattedAddress &&
            ` · ${deal.business.formattedAddress}`}
        </p>

        <Section title="When are you going?">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={date}
              min={minDateValue}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:border-zinc-900 bg-white"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:border-zinc-900 bg-white"
            />
          </div>
          {!isFutureEnough && (
            <p className="text-xs text-amber-700 mt-2">
              Schedule at least {LEAD_TIME_MIN} minutes from now.
            </p>
          )}
          <p className="text-[11px] text-zinc-500 mt-2">
            We&apos;ll text the redemption link ~15 min before. You have ±
            {deal.redeemWindowMinutes} min around this time to redeem at the
            business.
          </p>
        </Section>

        <Section title="Your details">
          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-500">
                Name
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                disabled={step === "verified"}
                className="w-full mt-1 px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:border-zinc-900 bg-white disabled:bg-zinc-50 disabled:text-zinc-500"
              />
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-500">
                Phone
              </span>
              {step === "phone" && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center flex-1 border border-zinc-300 rounded px-2 bg-white">
                    <Phone className="w-4 h-4 text-zinc-400 mr-1.5" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) =>
                        setPhone(formatPhoneNumber(e.target.value))
                      }
                      placeholder="555-555-5555"
                      className="flex-1 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={sendOTP}
                    disabled={otpSending || phone.replace(/\D/g, "").length < 10 || !name.trim()}
                    className="px-3 py-2 bg-zinc-900 text-white text-xs font-bold uppercase tracking-wider rounded disabled:opacity-50"
                  >
                    {otpSending ? "Sending…" : "Verify"}
                  </button>
                </div>
              )}
              {step === "code" && (
                <div className="space-y-2 mt-1">
                  <p className="text-xs text-zinc-500">
                    6-digit code sent to {phone}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="flex-1 px-3 py-2 border border-zinc-300 rounded text-sm tracking-[0.5em] text-center focus:outline-none focus:border-zinc-900 bg-white"
                    />
                    <button
                      onClick={verifyOTP}
                      disabled={otpSending || code.length < 6}
                      className="px-3 py-2 bg-zinc-900 text-white text-xs font-bold uppercase tracking-wider rounded disabled:opacity-50"
                    >
                      {otpSending ? "…" : "Confirm"}
                    </button>
                  </div>
                  <button
                    onClick={() => setStep("phone")}
                    className="text-xs text-zinc-400 underline"
                  >
                    Change number
                  </button>
                </div>
              )}
              {step === "verified" && (
                <div className="flex items-center gap-2 py-2 mt-1">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm text-emerald-700 font-medium">
                    {phone} verified
                  </span>
                </div>
              )}
              {otpError && (
                <p className="text-xs text-red-500 mt-1">{otpError}</p>
              )}
            </label>
          </div>
        </Section>

        {submitError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm text-zinc-500 px-3 py-2 hover:text-zinc-900"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 text-white text-xs font-bold uppercase tracking-widest rounded-lg px-5 py-3 disabled:opacity-50"
            style={{ backgroundColor: brandColor || "#18181b" }}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Schedule & text me
          </button>
        </div>

        <p className="text-[10px] text-zinc-400 text-center leading-relaxed">
          By scheduling, you agree to receive a one-time SMS with the redemption
          link. Message and data rates may apply.
        </p>
      </div>
    </Frame>
  );
}

function Frame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    // stopPropagation on the overlay — this modal is sometimes rendered as a
    // child of a card-level onClick/onKeyDown handler (e.g. DealsStrip
    // CompactDealCard). Without this, mouse + keyboard events bubble up to
    // the parent card and re-trigger the propose-plan flow. Need to stop
    // keyboard events too because the parent listens for Enter/Space — a
    // single keystroke while typing in a textarea will fire the parent.
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onKeyPress={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm"
    >
      <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] tracking-wider uppercase font-bold text-zinc-500 mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}
