"use client";

/**
 * Sign in for local places, without passwords: we email a 6-digit code (and
 * one-tap links to their dashboard). The code signs this device in for 90
 * days (lib/merchant-session). The answer is the same whether or not the
 * email is on file.
 */

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { Brand, Field, Shell, input } from "@/app/o/m/[token]/ui";
import { type RememberedPartner, forgetPartner, rememberedPartner } from "@/app/o/m/[token]/remember";
import { forgetSession, saveSession, signedInPartner } from "@/lib/merchant-session";

export default function LoginClient() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  // This device is signed in (or has been to their dashboard): offer it straight away.
  const [known, setKnown] = useState<RememberedPartner | null>(null);
  useEffect(() => {
    setKnown(signedInPartner() || rememberedPartner());
  }, []);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run("verifyMerchantLoginCode", { email, code })) as { sessions: { token: string; name: string; session: string }[] };
      const rows = r.sessions || [];
      for (const row of rows) saveSession(row.token, row.session, row.name);
      if (rows[0]) window.location.href = `/o/m/${rows[0].token}`;
      else setError("We couldn't find a dashboard for that email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work. Try again?");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run("requestMerchantLogin", { email })) as { message: string };
      setSent(r.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <Brand />
      <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-700">Partner sign in</p>
        <h1 className="mt-2 font-fm-serif text-[34px] leading-[1.05] text-stone-900">{known ? "Welcome back" : "Sign in"}</h1>
        {known && !sent ? (
          <>
            <a
              href={`/o/m/${known.token}`}
              className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-leaf-800 text-[17px] font-semibold text-white"
            >
              {known.name ? `Continue as ${known.name}` : "Go to your dashboard"}
            </a>
            <button
              type="button"
              onClick={() => {
                if (known) forgetSession(known.token);
                forgetPartner();
                setKnown(null);
              }}
              className="mt-4 text-[15px] font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4"
            >
              Not you? Use a different email
            </button>
          </>
        ) : sent ? (
          <form onSubmit={verify} className="mt-4 space-y-4">
            <p className="text-[16px] leading-relaxed text-stone-700">{sent}</p>
            <Field label="6-digit code">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                className={`${input} tracking-[0.3em]`}
              />
            </Field>
            {error && <p className="text-[14px] text-red-600">{error}</p>}
            <button type="submit" disabled={busy || code.length !== 6} className="h-14 w-full rounded-2xl bg-leaf-800 text-[17px] font-semibold text-white disabled:opacity-50">
              {busy ? "Signing in\u2026" : "Sign in"}
            </button>
            <p className="text-[14px] leading-relaxed text-stone-500">On this phone? You can tap the link in the email instead. This device stays signed in for 90 days.</p>
            <button
              type="button"
              onClick={() => {
                setSent(null);
                setCode("");
                setError(null);
              }}
              className="text-[15px] font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4"
            >
              Use a different email
            </button>
          </form>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <p className="text-[16px] leading-relaxed text-stone-600">Enter the email you use with Leaf and we&rsquo;ll send you a sign-in code.</p>
            <Field label="Email">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" className={input} />
            </Field>
            {error && <p className="text-[14px] text-red-600">{error}</p>}
            <button type="submit" disabled={busy || !email} className="h-14 w-full rounded-2xl bg-leaf-800 text-[17px] font-semibold text-white disabled:opacity-50">
              {busy ? "Sending…" : "Email me a code"}
            </button>
          </form>
        )}
      </div>
      <p className="mt-5 px-1 text-[14px] text-stone-500">
        New to Leaf?{" "}
        <a href="/partners/join" className="font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4">
          Claim your free Neighbor Hour
        </a>
      </p>
    </Shell>
  );
}
