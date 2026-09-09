"use client";

import { useEffect, useMemo, useState } from "react";
import Parse from "@/lib/parse-client";
import { Check, Clock, Smartphone, Users } from "lucide-react";

export type ChatPollOption = {
  id: string;
  text: string;
  voteCount: number;
  guestNames: string[];
};

// Shape returned by the leaflets-server `getPollForGuest` cloud function.
export type ChatPollInfo = {
  pollId: string;
  question: string;
  chatName: string | null;
  options: ChatPollOption[];
  guestVotedOptionId: string | null;
  expired: boolean;
  expiresAtMs: number | null;
};

const GUEST_ID_KEY = "leaf-poll-guest-id";
const GUEST_NAME_KEY = "leaf-poll-guest-name";
const NAME_MAX_LENGTH = 40;
const APP_STORE_URL =
  "https://apps.apple.com/us/app/leaf-build-your-community/id1040588046";

function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id =
        window.crypto && "randomUUID" in window.crypto
          ? window.crypto.randomUUID()
          : "g_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

function readSavedName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(GUEST_NAME_KEY) || "";
  } catch {
    return "";
  }
}

function saveName(name: string) {
  try {
    window.localStorage.setItem(GUEST_NAME_KEY, name);
  } catch {
    // localStorage unavailable (private mode etc.) — the vote still goes through.
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

function formatTimeLeft(expiresAtMs: number | null): string | null {
  if (!expiresAtMs) return null;
  const ms = expiresAtMs - Date.now();
  if (ms <= 0) return "Closed";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(minutes, 1)}m left`;
}

export default function ChatPollVoteClient({
  sessionId,
  pollId,
  initial,
}: {
  sessionId: string;
  pollId: string;
  initial: ChatPollInfo | null;
}) {
  const [poll, setPoll] = useState<ChatPollInfo | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [guestId, setGuestId] = useState("");
  const [name, setName] = useState("");
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");
  const [nameNeeded, setNameNeeded] = useState(false);

  // Re-fetch with guestId so the server can mark which option this guest already picked.
  useEffect(() => {
    const id = getOrCreateGuestId();
    setGuestId(id);
    setName(readSavedName());

    let cancelled = false;
    (async () => {
      try {
        const result = (await Parse.Cloud.run("getPollForGuest", {
          sessionId,
          pollId,
          guestId: id,
        })) as ChatPollInfo;
        if (cancelled) return;
        setPoll(result);
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
  }, [sessionId, pollId]);

  const timeLeft = useMemo(
    () => formatTimeLeft(poll?.expiresAtMs ?? null),
    [poll?.expiresAtMs],
  );

  async function handleVote(optionId: string) {
    if (!poll || poll.expired || voting) return;
    const trimmed = name.trim().slice(0, NAME_MAX_LENGTH);
    if (!trimmed) {
      setNameNeeded(true);
      setError("Enter your name first.");
      return;
    }
    saveName(trimmed);
    setError("");
    setNameNeeded(false);
    setVoting(true);
    try {
      await Parse.Cloud.run("voteAsGuest", {
        sessionId,
        pollId,
        optionId,
        guestId,
        name: trimmed,
      });
      const fresh = (await Parse.Cloud.run("getPollForGuest", {
        sessionId,
        pollId,
        guestId,
      })) as ChatPollInfo;
      setPoll(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record your vote.");
    } finally {
      setVoting(false);
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

  const totalVotes = poll.options.reduce((sum, o) => sum + o.voteCount, 0);
  const hasVoted = poll.guestVotedOptionId !== null;
  const tappable = !poll.expired && !voting;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-sm">
        <div className="w-full h-24 bg-zinc-900" />

        <div className="px-5 py-6 space-y-5">
          <div className="space-y-2">
            <span className="text-[11px] uppercase tracking-widest font-bold text-zinc-400">
              {poll.chatName || "Leaf · Poll"}
            </span>
            <h1 className="text-2xl font-light tracking-tight text-zinc-900">
              {poll.question}
            </h1>
            <div className="flex items-center gap-4 text-[11px] uppercase tracking-widest font-bold text-zinc-400 pt-1">
              <span className="inline-flex items-center gap-1">
                <Users className="w-3 h-3" />
                {totalVotes} {totalVotes === 1 ? "Vote" : "Votes"}
              </span>
              {timeLeft && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeLeft}
                </span>
              )}
            </div>
          </div>

          {poll.expired ? (
            <div className="px-3 py-2 bg-amber-50 text-amber-700 text-xs rounded-md">
              Voting from the web has closed for this poll. Open it in the Leaf
              app to keep voting.
            </div>
          ) : (
            <div>
              <label
                htmlFor="guest-name"
                className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1"
              >
                Your name
              </label>
              <input
                id="guest-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameNeeded && e.target.value.trim()) {
                    setNameNeeded(false);
                    setError("");
                  }
                }}
                placeholder="First name"
                autoComplete="given-name"
                maxLength={NAME_MAX_LENGTH}
                className={`w-full border-b py-2 text-sm font-light focus:outline-none focus:border-zinc-900 ${
                  nameNeeded ? "border-red-400" : "border-zinc-300"
                }`}
              />
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              {poll.expired
                ? "Results"
                : hasVoted
                  ? "Tap another option to change your vote"
                  : "Tap an option to vote"}
            </p>
            {poll.options.map((opt) => {
              const isSelected = poll.guestVotedOptionId === opt.id;
              const pct =
                totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
              const shownGuests = opt.guestNames.slice(0, 5);
              const extraGuests = opt.guestNames.length - shownGuests.length;
              // Votes cast inside the app arrive as a count only (no names),
              // so without this row they'd inflate the tally invisibly.
              const appVotes = Math.max(0, opt.voteCount - opt.guestNames.length);
              return (
                <button
                  key={opt.id}
                  onClick={() => tappable && handleVote(opt.id)}
                  disabled={!tappable}
                  className={`relative w-full text-left rounded-lg border p-3 transition-all overflow-hidden ${
                    isSelected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"
                  } ${tappable ? "hover:border-zinc-400 cursor-pointer" : "cursor-default"}`}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-zinc-900 transition-all"
                    style={{ width: `${pct}%`, opacity: isSelected ? 0.12 : 0.06 }}
                  />
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-zinc-900 border-zinc-900" : "border-zinc-300"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {opt.text}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-zinc-700">
                        {opt.voteCount} {opt.voteCount === 1 ? "vote" : "votes"}
                      </p>
                      {totalVotes > 0 && (
                        <p className="text-xs text-zinc-400">{pct}%</p>
                      )}
                    </div>
                  </div>
                  {(shownGuests.length > 0 || appVotes > 0) && (
                    <div className="relative flex items-center mt-2 pl-8">
                      {shownGuests.map((guestName, i) => (
                        <span
                          key={`${guestName}-${i}`}
                          title={guestName}
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-200 text-zinc-600 text-[10px] font-semibold border-2 border-white -ml-1.5 first:ml-0"
                        >
                          {initials(guestName)}
                        </span>
                      ))}
                      {extraGuests > 0 && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-200 text-zinc-600 text-[10px] font-semibold border-2 border-white -ml-1.5">
                          +{extraGuests}
                        </span>
                      )}
                      {appVotes > 0 && (
                        <span
                          className={`text-[11px] text-zinc-400 ${
                            shownGuests.length > 0 ? "ml-2" : ""
                          }`}
                        >
                          {appVotes} in the app
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <p
            className={`text-xs text-center min-h-[1rem] ${
              error ? "text-red-500" : "text-zinc-500"
            }`}
          >
            {error || (voting ? "Saving…" : hasVoted && !poll.expired ? "Vote recorded." : "")}
          </p>

          <div className="pt-4 border-t border-zinc-100 text-center">
            <a
              href={APP_STORE_URL}
              className="inline-flex items-center gap-1 text-[11px] uppercase tracking-widest font-bold text-zinc-400 hover:text-zinc-700"
            >
              <Smartphone className="w-3 h-3" />
              Want to host your own polls? Get the Leaf app
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
