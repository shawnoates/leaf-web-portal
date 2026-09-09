"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

// Shown to a returning visitor whose account has no name — verifyOTP mints
// phone-only users, and some older host/follow paths never wrote one. The
// server's write is name-if-empty, so this can't rename anyone.
export default function NamePrompt({
  brandColor,
  onSave,
}: {
  brandColor?: string | null;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = name.trim().length > 0;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSave(name.trim());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't save your name.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-prompt-title"
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4"
      >
        <div className="space-y-1">
          <h2 id="name-prompt-title" className="text-lg font-semibold text-zinc-900">
            What should we call you?
          </h2>
          <p className="text-sm text-zinc-500">
            Your account doesn&rsquo;t have a name yet. Hosts and attendees see it on plans.
          </p>
        </div>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          disabled={busy}
          maxLength={100}
          placeholder="Full name"
          className="w-full border-b border-zinc-300 py-3 text-lg font-light focus:outline-none focus:border-zinc-900 transition-colors disabled:text-zinc-500"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          onClick={submit}
          disabled={!ready || busy}
          className="w-full py-3 text-xs font-bold uppercase tracking-widest text-white rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
          style={{ backgroundColor: brandColor || "#18181b" }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
        </button>
      </div>
    </div>
  );
}
