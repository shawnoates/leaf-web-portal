"use client";

/**
 * A host or venue page on a device that isn't signed in (lib/link-session):
 * email them a 6-digit code, enter it, and this device stays signed in.
 */

import { useState } from "react";
import Parse from "@/lib/parse-client";
import { type LinkPage, saveLinkSession } from "@/lib/link-session";

const input = "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-[15px] text-zinc-900 focus:border-leaf-600 focus:outline-none";

export default function LinkSignInGate({ page, token, hint, onSignedIn }: { page: LinkPage; token: string; hint: string; onSignedIn: () => void }) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run("sendLinkCode", { page, token })) as { emailHint: string };
      setSentTo(r.emailHint || hint || "your email");
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't send a code. Try again?");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run("verifyLinkCode", { page, token, code })) as { session: string };
      saveLinkSession(token, r.session);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work. Try again?");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/leaf-logo-black.png" alt="Leaf" className="h-7 w-auto" />
      <h1 className="mt-8 text-2xl font-semibold leading-tight text-leaf-900">Sign in to continue</h1>
      <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5">
        {!sentTo ? (
          <>
            <p className="text-[15px] leading-relaxed text-zinc-700">
              This device isn&rsquo;t signed in yet. We&rsquo;ll email a 6-digit code{hint ? ` to ${hint}` : ""} to keep this page yours.
            </p>
            <button type="button" onClick={send} disabled={busy} className="mt-4 w-full rounded-xl bg-leaf-800 px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-50">
              {busy ? "Sending…" : "Email me a code"}
            </button>
          </>
        ) : (
          <form onSubmit={verify}>
            <p className="text-[15px] leading-relaxed text-zinc-700">We sent a code to {sentTo}. It works for 15 minutes.</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
              aria-label="6-digit code"
              className={`${input} mt-3 tracking-[0.3em]`}
            />
            <button type="submit" disabled={busy || code.length !== 6} className="mt-3 w-full rounded-xl bg-leaf-800 px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-50">
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button type="button" onClick={send} disabled={busy} className="mt-3 text-[14px] font-semibold text-leaf-700 underline disabled:opacity-50">
              Send a new code
            </button>
          </form>
        )}
        {error && <p className="mt-3 text-[14px] text-red-700">{error}</p>}
      </div>
      <p className="mt-4 text-[14px] text-zinc-500">Can&rsquo;t get to that inbox? Write shawn@getleaflets.co.</p>
    </main>
  );
}
