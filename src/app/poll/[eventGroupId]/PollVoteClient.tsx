"use client";

import { useEffect, useMemo, useState } from "react";
import Parse from "@/lib/parse-client";
import {
  Calendar,
  Check,
  Clock,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";

type PollOption = { date: string; time: string | null; count: number };

type PollInfo = {
  eventGroupId: string;
  title: string;
  description: string;
  image: string | null;
  calendar: {
    id: string;
    name: string;
    profilePhoto: string | null;
    brandColor: string | null;
  } | null;
  host: { name: string } | null;
  poll: {
    postId: string;
    options: PollOption[];
    totalVotes: number;
    expiresAt: string | null;
    isExpired: boolean;
  };
  guestVotedKeys: string[];
};

type Step = "select" | "phone" | "code" | "done";

const GUEST_ID_KEY = "leaf-poll-guest-id";

function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      // Use crypto.randomUUID where available; fall back to a Math-random uuid.
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
  // dateStr is YYYY-MM-DD — parse as local date to avoid TZ shift.
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTime(time: string | null): string | null {
  if (!time) return null;
  // time is HH:MM 24h
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

export default function PollVoteClient({
  eventGroupId,
  initial,
}: {
  eventGroupId: string;
  initial: PollInfo | null;
}) {
  const [poll, setPoll] = useState<PollInfo | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [guestId, setGuestId] = useState("");

  // Initialize guestId + re-fetch poll with guestId so the server can mark prefill.
  useEffect(() => {
    const id = getOrCreateGuestId();
    setGuestId(id);

    let cancelled = false;
    (async () => {
      try {
        const result = (await Parse.Cloud.run("getCalendarDatePollForGuest", {
          eventGroupId,
          guestId: id,
        })) as PollInfo;
        if (cancelled) return;
        setPoll(result);
        if (result.guestVotedKeys && result.guestVotedKeys.length > 0) {
          setSelected(new Set(result.guestVotedKeys));
          setStep("done");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[poll] fetch failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventGroupId]);

  const brandColor = poll?.calendar?.brandColor || "#18181b";

  const expiresIn = useMemo(() => {
    if (!poll?.poll.expiresAt) return null;
    const ms = new Date(poll.poll.expiresAt).getTime() - Date.now();
    if (ms <= 0) return "Closed";
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days >= 1) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  }, [poll?.poll.expiresAt]);

  function toggleOption(opt: PollOption) {
    if (step !== "select") return;
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

  async function handleSubmitVote() {
    setError("");
    if (code.length < 4) {
      setError("Enter the full code.");
      return;
    }
    if (!poll) return;

    const digits = phone.replace(/\D/g, "");
    const selectedOptions = poll.poll.options
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
        code,
        name: name.trim(),
        selectedOptions,
        guestId,
      });
      // Re-fetch to refresh tally counts and confirm prefill state.
      const fresh = (await Parse.Cloud.run("getCalendarDatePollForGuest", {
        eventGroupId,
        guestId,
      })) as PollInfo;
      setPoll(fresh);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record your vote.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-zinc-400">
        Loading poll…
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-medium text-zinc-900">Poll not found</h1>
        <p className="text-sm text-zinc-500 mt-2">
          This link may have been removed or is no longer active.
        </p>
      </div>
    );
  }

  const canProceed = selected.size > 0 && !poll.poll.isExpired;
  const totalVotes = poll.poll.totalVotes;
  const hasVoted = step === "done";

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-sm">
        {/* Hero */}
        {poll.image ? (
          <div className="relative w-full h-48 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poll.image}
              alt={poll.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className="w-full h-32"
            style={{ backgroundColor: brandColor }}
          />
        )}

        <div className="px-5 py-6 space-y-5">
          {/* Header */}
          <div className="space-y-2">
            {poll.calendar && (
              <div className="flex items-center gap-2">
                {poll.calendar.profilePhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={poll.calendar.profilePhoto}
                    alt={poll.calendar.name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                )}
                <span className="text-[11px] uppercase tracking-widest font-bold text-zinc-400">
                  {poll.calendar.name}
                </span>
              </div>
            )}
            <h1 className="text-2xl font-light tracking-tight text-zinc-900">
              {poll.title}
            </h1>
            {poll.description && (
              <p className="text-sm text-zinc-500 leading-relaxed">
                {poll.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-[11px] uppercase tracking-widest font-bold text-zinc-400 pt-1">
              <span className="inline-flex items-center gap-1">
                <Users className="w-3 h-3" />
                {totalVotes} {totalVotes === 1 ? "Vote" : "Votes"}
              </span>
              {expiresIn && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {expiresIn}
                </span>
              )}
            </div>
          </div>

          {poll.poll.isExpired && (
            <div className="px-3 py-2 bg-amber-50 text-amber-700 text-xs rounded-md">
              This poll is closed. Vote tallies are final.
            </div>
          )}

          {/* Options */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              {hasVoted ? "Results" : "Pick what works for you"}
            </p>
            {poll.poll.options.map((opt) => {
              const key = optionKey(opt);
              const isSelected = selected.has(key);
              const pct = totalVotes > 0 ? Math.round((opt.count / totalVotes) * 100) : 0;
              const tappable = step === "select" && !poll.poll.isExpired;
              return (
                <button
                  key={key}
                  onClick={() => tappable && toggleOption(opt)}
                  disabled={!tappable}
                  className={`relative w-full text-left rounded-lg border p-3 transition-all overflow-hidden ${
                    isSelected
                      ? "border-zinc-900 bg-zinc-50"
                      : "border-zinc-200"
                  } ${tappable ? "hover:border-zinc-400 cursor-pointer" : "cursor-default"}`}
                >
                  {hasVoted && (
                    <div
                      className="absolute inset-y-0 left-0 transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: brandColor,
                        opacity: 0.08,
                      }}
                    />
                  )}
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-zinc-900 border-zinc-900"
                            : "border-zinc-300"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">
                          {formatDate(opt.date)}
                        </p>
                        {formatTime(opt.time) && (
                          <p className="text-xs text-zinc-500">
                            {formatTime(opt.time)}
                          </p>
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

          {/* Step content */}
          {step === "select" && !poll.poll.isExpired && (
            <button
              onClick={() => setStep("phone")}
              disabled={!canProceed}
              className="w-full py-3 text-xs font-bold uppercase tracking-widest rounded-lg text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: brandColor }}
            >
              Continue
            </button>
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
                onClick={handleSendCode}
                disabled={submitting}
                className="w-full py-3 text-xs font-bold uppercase tracking-widest rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: brandColor }}
              >
                {submitting ? "Sending…" : "Send code"}
              </button>
              <button
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
              <p className="text-xs text-zinc-500">
                Code sent to +1 {phone}.
              </p>
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
                onClick={handleSubmitVote}
                disabled={submitting}
                className="w-full py-3 text-xs font-bold uppercase tracking-widest rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: brandColor }}
              >
                {submitting ? "Recording vote…" : "Submit vote"}
              </button>
              <button
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
                {poll.host?.name
                  ? `${poll.host.name} will share the final pick once the poll closes.`
                  : "The host will share the final pick once the poll closes."}
              </p>
              {poll.calendar && (
                <a
                  href={`/org/${poll.calendar.id}`}
                  className="block text-center text-[11px] uppercase tracking-widest font-bold text-zinc-400 hover:text-zinc-700 pt-1"
                >
                  See the calendar
                </a>
              )}
            </div>
          )}

          <div className="flex items-center justify-center pt-4">
            <span className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-zinc-300">
              <Calendar className="w-3 h-3" />
              Powered by Leaf
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
