"use client";

import { useEffect, useMemo, useState } from "react";
import Parse from "@/lib/parse-client";
import { Check, Clock, ShieldCheck, Smartphone } from "lucide-react";
import { setVerifiedUserCookie, getVerifiedUserCookie } from "@/lib/verified-user";

type PollOption = { date: string; time: string | null; count: number };

type PollDetail = {
  options: PollOption[];
  totalVotes: number;
  expiresAt: string | null;
  isExpired: boolean;
  guestVotedKeys: string[];
};

type Step = "select" | "phone" | "code" | "done";

const GUEST_ID_KEY = "leaf-poll-guest-id";

function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = (window.crypto && "randomUUID" in window.crypto)
        ? window.crypto.randomUUID()
        : "g_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

function optionKey(opt: { date: string; time: string | null }): string {
  return `${opt.date}|${opt.time || ""}`;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return time;
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function PollVoteWidget({
  eventGroupId,
  brandColor = "#18181b",
  initial,
  onVoted,
}: {
  eventGroupId: string;
  brandColor?: string;
  initial?: PollDetail | null;
  onVoted?: () => void;
}) {
  const [detail, setDetail] = useState<PollDetail | null>(initial ?? null);
  const [loading, setLoading] = useState(!initial);
  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [guestId, setGuestId] = useState("");
  // If the browser already has a verified phone from a prior RSVP/poll on this
  // domain, we skip OTP and submit directly — same trust model as rsvpToPlanViaWeb.
  const [preVerified, setPreVerified] = useState(false);

  useEffect(() => {
    const id = getOrCreateGuestId();
    setGuestId(id);

    // Pull a verified-user cookie if one's been set by an earlier RSVP/poll.
    const cached = getVerifiedUserCookie();
    if (cached) {
      setName(cached.name);
      setPhone(cached.phone);
      setPreVerified(true);
    }

    let cancelled = false;
    (async () => {
      try {
        const result = (await Parse.Cloud.run("getCalendarDatePollForGuest", {
          eventGroupId,
          guestId: id,
        })) as { poll: { options: PollOption[]; totalVotes: number; expiresAt: string | null; isExpired: boolean }; guestVotedKeys: string[] };
        if (cancelled) return;
        const next: PollDetail = {
          options: result.poll.options || [],
          totalVotes: result.poll.totalVotes || 0,
          expiresAt: result.poll.expiresAt || null,
          isExpired: !!result.poll.isExpired,
          guestVotedKeys: result.guestVotedKeys || [],
        };
        setDetail(next);
        if (next.guestVotedKeys.length > 0) {
          setSelected(new Set(next.guestVotedKeys));
          setStep("done");
        }
      } catch (err) {
        if (!cancelled) console.error("[poll-widget] fetch failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [eventGroupId]);

  const expiresIn = useMemo(() => {
    if (!detail?.expiresAt) return null;
    const ms = new Date(detail.expiresAt).getTime() - Date.now();
    if (ms <= 0) return "Closed";
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days >= 1) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  }, [detail?.expiresAt]);

  function toggleOption(opt: PollOption) {
    if (step !== "select" || detail?.isExpired) return;
    const key = optionKey(opt);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSendCode() {
    setError("");
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    setSubmitting(true);
    try {
      await Parse.Cloud.run("requestOTP", { phone: `+1${digits}` });
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleContinue() {
    setError("");
    if (selected.size === 0) {
      setError("Pick at least one option.");
      return;
    }
    // Pre-verified users (cookie from a prior RSVP or poll on this domain) skip OTP.
    if (preVerified) {
      await submitVote({ withCode: false });
      return;
    }
    setStep("phone");
  }

  async function submitVote({ withCode }: { withCode: boolean }) {
    if (!detail) return;
    if (withCode && code.length < 4) {
      setError("Enter the full code.");
      return;
    }

    const digits = phone.replace(/\D/g, "");
    const selectedOptions = detail.options
      .filter((o) => selected.has(optionKey(o)))
      .map((o) => ({ date: o.date, time: o.time }));

    if (selectedOptions.length === 0) {
      setError("Pick at least one option.");
      setStep("select");
      return;
    }

    setSubmitting(true);
    try {
      await Parse.Cloud.run("submitCalendarPollVote", {
        eventGroupId,
        phone: `+1${digits}`,
        ...(withCode ? { code } : {}),
        name: name.trim(),
        selectedOptions,
        guestId,
      });
      // First-time OTP verification — cache so future polls/RSVPs skip OTP.
      if (withCode) setVerifiedUserCookie(name.trim(), phone);
      // Re-fetch to refresh tally counts.
      const fresh = (await Parse.Cloud.run("getCalendarDatePollForGuest", {
        eventGroupId,
        guestId,
      })) as { poll: { options: PollOption[]; totalVotes: number; expiresAt: string | null; isExpired: boolean }; guestVotedKeys: string[] };
      setDetail({
        options: fresh.poll.options || [],
        totalVotes: fresh.poll.totalVotes || 0,
        expiresAt: fresh.poll.expiresAt || null,
        isExpired: !!fresh.poll.isExpired,
        guestVotedKeys: fresh.guestVotedKeys || [],
      });
      setStep("done");
      onVoted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record your vote.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitVote() {
    setError("");
    await submitVote({ withCode: true });
  }

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading poll…</p>;
  }
  if (!detail) {
    return <p className="text-sm text-zinc-500">Couldn&apos;t load this poll.</p>;
  }

  const totalVotes = detail.totalVotes;
  const hasVoted = step === "done";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
          {hasVoted ? "Results" : "Pick what works for you"}
        </p>
        {expiresIn && (
          <span className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-zinc-400">
            <Clock className="w-3 h-3" /> {expiresIn}
          </span>
        )}
      </div>

      {detail.isExpired && (
        <div className="px-3 py-2 bg-amber-50 text-amber-700 text-xs rounded-md">
          This poll is closed. Vote tallies are final.
        </div>
      )}

      <div className="space-y-2">
        {detail.options.map((opt) => {
          const key = optionKey(opt);
          const isSelected = selected.has(key);
          const pct = totalVotes > 0 ? Math.round((opt.count / totalVotes) * 100) : 0;
          const tappable = step === "select" && !detail.isExpired;
          return (
            <button
              key={key}
              type="button"
              onClick={() => tappable && toggleOption(opt)}
              disabled={!tappable}
              className={`relative w-full text-left rounded-lg border p-3 transition-all overflow-hidden ${
                isSelected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"
              } ${tappable ? "hover:border-zinc-400 cursor-pointer" : "cursor-default"}`}
            >
              {hasVoted && (
                <div
                  className="absolute inset-y-0 left-0 transition-all"
                  style={{ width: `${pct}%`, backgroundColor: brandColor, opacity: 0.08 }}
                />
              )}
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-zinc-900 border-zinc-900" : "border-zinc-300"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">
                      {formatDate(opt.date)}
                    </p>
                    {formatTime(opt.time) && (
                      <p className="text-xs text-zinc-500">{formatTime(opt.time)}</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-zinc-700">
                    {opt.count} {opt.count === 1 ? "vote" : "votes"}
                  </p>
                  {hasVoted && totalVotes > 0 && (
                    <p className="text-xs text-zinc-400">{pct}%</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {step === "select" && !detail.isExpired && (
        <>
          {preVerified && (
            <p className="text-xs tracking-widest uppercase text-zinc-400 text-center">
              Voting as <span className="text-zinc-700 font-bold">{name}</span>
              {" · "}
              <button
                type="button"
                onClick={() => { setPreVerified(false); setName(""); setPhone(""); setStep("phone"); }}
                className="underline hover:text-zinc-700"
              >
                use a different number
              </button>
            </p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="button"
            onClick={handleContinue}
            disabled={selected.size === 0 || submitting}
            className="w-full py-3 text-xs font-bold uppercase tracking-widest rounded-lg text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? "Recording vote…" : preVerified ? "Submit vote" : "Continue"}
          </button>
        </>
      )}

      {step === "phone" && (
        <div className="space-y-3 pt-2 border-t border-zinc-100">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-zinc-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-700">
              Verify your phone
            </p>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            We&apos;ll text you a one-time code so each vote counts only once.
          </p>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">
              Your name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name"
              className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">
              Phone
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">+1</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(555) 123-4567"
                className="flex-1 border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="button"
            onClick={handleSendCode}
            disabled={submitting}
            className="w-full py-3 text-xs font-bold uppercase tracking-widest rounded-lg text-white disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? "Sending…" : "Send code"}
          </button>
          <button
            type="button"
            onClick={() => setStep("select")}
            className="w-full text-[11px] text-zinc-400 hover:text-zinc-700"
          >
            Back to options
          </button>
        </div>
      )}

      {step === "code" && (
        <div className="space-y-3 pt-2 border-t border-zinc-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-zinc-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-700">
              Enter code
            </p>
          </div>
          <p className="text-xs text-zinc-500">Code sent to +1 {phone}.</p>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            autoFocus
            className="w-full border border-zinc-200 rounded-lg py-3 text-center text-base tracking-widest focus:outline-none focus:border-zinc-900"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="button"
            onClick={handleSubmitVote}
            disabled={submitting}
            className="w-full py-3 text-xs font-bold uppercase tracking-widest rounded-lg text-white disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? "Recording vote…" : "Submit vote"}
          </button>
          <button
            type="button"
            onClick={() => { setStep("phone"); setCode(""); setError(""); }}
            className="w-full text-[11px] text-zinc-400 hover:text-zinc-700"
          >
            Use a different number
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-3 pt-2 border-t border-zinc-100">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ backgroundColor: brandColor }}
            >
              <Check className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm font-medium text-zinc-900">
              Your vote is recorded
            </p>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            The host will share the final pick once the poll closes.
          </p>
        </div>
      )}
    </div>
  );
}
