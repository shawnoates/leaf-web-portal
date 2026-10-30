"use client";

/**
 * A Drop pass. The guest shows it at the door; the host (or Leaf) taps Check
 * in. The token is the auth, as for deal redemptions; checking in needs the
 * host's or an admin's own session.
 */

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Check, Loader2 } from "lucide-react";
import Parse from "@/lib/parse-client";
import { dropWhen, money, type Drop } from "@/lib/drops";

type Pass = {
  drop: Drop;
  name: string;
  paidCents: number;
  status: "paid" | "cancelled";
  accessNote: string;
  checkedInAt: string | null;
  canCheckIn: boolean;
};

export default function DropPassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [pass, setPass] = useState<Pass | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Parse.Cloud.run("getDropPass", { token })
      .then((r: Pass) => setPass(r))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load this pass."));
  }, [token]);
  useEffect(load, [load]);

  const checkIn = async () => {
    setBusy(true);
    try {
      const r = (await Parse.Cloud.run("checkInDropPass", { token })) as { checkedInAt: string };
      setPass((p) => (p ? { ...p, checkedInAt: r.checkedInAt } : p));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't check them in.");
    } finally {
      setBusy(false);
    }
  };

  if (error && !pass) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FBFAF6" }}>
        <p className="text-sm text-zinc-600 text-center">{error}</p>
      </main>
    );
  }
  if (!pass) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#FBFAF6" }}>
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </main>
    );
  }

  const { drop } = pass;
  const url = typeof window !== "undefined" ? window.location.href : "";
  const refunded = pass.status === "cancelled";

  return (
    <main className="min-h-screen px-4 py-8 flex justify-center" style={{ background: "#FBFAF6" }}>
      <div className="w-full max-w-sm flex flex-col gap-4">
        <section className="rounded-2xl p-5 flex flex-col gap-2 text-white" style={{ background: "#131714" }}>
          <span className="text-[10px] tracking-[0.12em] uppercase font-bold" style={{ color: "#C9F27B" }}>
            ◆ Drop pass{drop.calendar?.name ? ` · ${drop.calendar.name}` : ""}
          </span>
          <h1 className="text-2xl font-medium leading-snug">{drop.title}</h1>
          <p className="text-sm text-white/70">{[dropWhen(drop.startsAt), drop.place].filter(Boolean).join(" · ")}</p>
          {drop.includes && <p className="text-sm">Includes: {drop.includes}</p>}
          <p className="text-xs text-white/60">
            {pass.name ? `${pass.name} · ` : ""}
            {refunded ? `Refunded ${money(drop.pass?.refundedCents || pass.paidCents)}` : `Held for ${money(pass.paidCents)}`}
          </p>
        </section>

        {refunded ? (
          <p className="text-sm text-zinc-600 text-center">This drop was called off and your fee was refunded.</p>
        ) : (
          <>
            {pass.accessNote && (
              <section className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-1">
                <span className="text-[10px] tracking-[0.12em] uppercase font-bold text-zinc-500">How to get in</span>
                <p className="text-sm text-zinc-800 whitespace-pre-line">{pass.accessNote}</p>
              </section>
            )}

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 flex flex-col items-center gap-3">
              {pass.checkedInAt ? (
                <p className="flex items-center gap-2 text-emerald-700 font-medium">
                  <Check className="w-5 h-5" /> Checked in
                </p>
              ) : (
                <>
                  {url && <QRCodeSVG value={url} size={168} />}
                  <p className="text-xs text-zinc-500 text-center">Show this at the door.</p>
                </>
              )}
              {pass.canCheckIn && !pass.checkedInAt && (
                <button
                  onClick={checkIn}
                  disabled={busy}
                  className="w-full inline-flex justify-center items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "#131714" }}
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} Check in {pass.name || "guest"}
                </button>
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
            </section>
          </>
        )}

        <Link href="/me" className="text-center text-xs text-zinc-500 underline">
          Your plans
        </Link>
      </div>
    </main>
  );
}
