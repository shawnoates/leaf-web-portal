"use client";

/**
 * Sign in for local places, without passwords: we email the link to their
 * dashboard. The answer is the same whether or not the email is on file.
 */

import { useState } from "react";
import Parse from "@/lib/parse-client";
import { Brand, Field, Shell, input } from "@/app/o/m/[token]/ui";

export default function LoginClient() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-700">Your Leaf nights</p>
        <h1 className="mt-2 font-fm-serif text-[34px] leading-[1.05] text-stone-900">Sign in</h1>
        {sent ? (
          <>
            <p className="mt-3 text-[16px] leading-relaxed text-stone-700">{sent}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-stone-500">It opens your dashboard: your nights, RSVPs, bookings and settings. No password needed.</p>
            <button type="button" onClick={() => setSent(null)} className="mt-5 text-[15px] font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4">
              Use a different email
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <p className="text-[16px] leading-relaxed text-stone-600">Enter the email you use with Leaf and we&rsquo;ll send you a link to your dashboard.</p>
            <Field label="Email">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" className={input} />
            </Field>
            {error && <p className="text-[14px] text-red-600">{error}</p>}
            <button type="submit" disabled={busy || !email} className="h-14 w-full rounded-2xl bg-leaf-800 text-[17px] font-semibold text-white disabled:opacity-50">
              {busy ? "Sending…" : "Email me my link"}
            </button>
          </form>
        )}
      </div>
      <p className="mt-5 px-1 text-[14px] text-stone-500">
        New to Leaf?{" "}
        <a href="/partner" className="font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4">
          Host neighbors at your place
        </a>
      </p>
    </Shell>
  );
}
