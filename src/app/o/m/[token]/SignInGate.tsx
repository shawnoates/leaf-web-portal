"use client";

/**
 * A signed-up business's page on a device that isn't signed in: email the
 * business a 6-digit code, enter it, and this device stays signed in
 * (lib/merchant-session). The code goes to the business, not to whoever
 * has the link.
 */

import { useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { saveSession } from "@/lib/merchant-session";
import { Brand, Shell, input } from "./ui";

export default function SignInGate({ token, hint, onSignedIn }: { token: string; hint: string; onSignedIn: () => void }) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run("sendMerchantLoginCode", { token })) as { emailHint: string };
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
      const r = (await Parse.Cloud.run("verifyMerchantLoginCode", { token, code })) as { sessions: { token: string; name: string; session: string }[] };
      for (const s of r.sessions || []) saveSession(s.token, s.session, s.name);
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code didn't work. Try again?");
      setBusy(false);
    }
  };

  return (
    <Shell>
      <Brand />
      <header className="mt-8 px-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-700">Partner sign in</p>
        <h1 className="mt-2 font-fm-serif text-[34px] leading-[1.05] text-stone-900">Sign in to your dashboard</h1>
      </header>
      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
        {!sentTo ? (
          <>
            <p className="text-[16px] leading-relaxed text-stone-700">
              This device isn&rsquo;t signed in yet. We&rsquo;ll email a 6-digit code{hint ? ` to ${hint}` : " to your business"} to keep your page yours.
            </p>
            <button type="button" onClick={send} disabled={busy} className="mt-5 h-14 w-full rounded-2xl bg-leaf-800 text-[17px] font-semibold text-white disabled:opacity-50">
              {busy ? "Sending…" : "Email me a code"}
            </button>
          </>
        ) : (
          <form onSubmit={verify}>
            <p className="text-[16px] leading-relaxed text-stone-700">We sent a code to {sentTo}. It works for 15 minutes.</p>
            <label className="mt-4 block text-[13px] font-semibold uppercase tracking-[0.08em] text-stone-500" htmlFor="code">
              Code
            </label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
              className={`${input} mt-1 tracking-[0.3em]`}
            />
            <button type="submit" disabled={busy || code.length !== 6} className="mt-4 h-14 w-full rounded-2xl bg-leaf-800 text-[17px] font-semibold text-white disabled:opacity-50">
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button type="button" onClick={send} disabled={busy} className="mt-3 text-[15px] font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4 disabled:opacity-50">
              Send a new code
            </button>
          </form>
        )}
        {error && <p className="mt-3 text-[14px] text-red-700">{error}</p>}
      </div>
      <p className="mt-5 px-1 text-[14px] text-stone-500">
        Don&rsquo;t have that inbox?{" "}
        <Link href="/partners/login" className="font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4">
          Sign in with another email
        </Link>{" "}
        or write shawn@getleaflets.co.
      </p>
    </Shell>
  );
}
