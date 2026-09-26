"use client";

/**
 * The placard page — /o/p/[token] (Offer Pipeline, spec §10)
 *
 * Linked from the intro email to whoever has the room. Three choices:
 *   - Print it now: a 4x6 counter card or a letter flyer with tear-off QR
 *     tabs, rendered here and printed from the browser (Save as PDF works
 *     too). Built for a cheap office printer: dark ink on white, no full
 *     bleed, a high-contrast QR.
 *   - Mail me one: after their first night only; one stand, a table tent,
 *     up to 25 register cards.
 *   - Not now.
 * Every format carries the same QR, tagged with this venue's code, so scans
 * and follows count back to the counter they came from.
 */

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Parse from "@/lib/parse-client";

type Page = {
  state: "ok" | "unavailable";
  name: string;
  headline: string;
  examples: string;
  qrUrl: string;
  qrCode: string;
  answer: "yes" | "maybe" | "no" | null;
  canMail: boolean;
  mailRequest: { items: { stand: number; tent: number; cards: number }; requestedAt: string } | null;
  maxCards: number;
};

type Format = "counter" | "flyer";

const INK = "#253A33";
const input =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-[15px] text-zinc-900 focus:border-leaf-600 focus:outline-none";

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-2xl px-5 py-10 pb-24">{children}</main>;
}

/** 4x6 counter card. Sized in inches so print is exact. */
function CounterCard({ p }: { p: Page }) {
  return (
    <div className="placard-print placard-counter mx-auto flex flex-col items-center justify-between bg-white text-center" style={{ width: "4in", height: "6in", padding: "0.35in", color: INK }}>
      <div>
        <p style={{ fontSize: "20pt", fontWeight: 700, lineHeight: 1.15 }}>{p.headline}</p>
        <p style={{ fontSize: "10pt", marginTop: "0.12in", color: "#3f4f49" }}>{p.examples}</p>
      </div>
      <div>
        <QRCodeSVG value={p.qrUrl} size={200} level="M" fgColor="#000000" bgColor="#ffffff" />
        <p style={{ fontSize: "11pt", fontWeight: 600, marginTop: "0.1in" }}>Scan to see what&rsquo;s on</p>
      </div>
      <p style={{ fontSize: "8pt", color: "#56645f" }}>Proud partner: {p.name}</p>
    </div>
  );
}

/** Letter flyer with a row of tear-off QR tabs along the bottom. */
function Flyer({ p }: { p: Page }) {
  const tabs = Array.from({ length: 6 });
  return (
    <div className="placard-print placard-flyer mx-auto flex flex-col bg-white" style={{ width: "8.5in", height: "11in", padding: "0.5in", color: INK }}>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <p style={{ fontSize: "36pt", fontWeight: 700, lineHeight: 1.1, maxWidth: "6.5in" }}>{p.headline}</p>
        <p style={{ fontSize: "14pt", marginTop: "0.2in", color: "#3f4f49", maxWidth: "6in" }}>{p.examples}</p>
        <div style={{ marginTop: "0.45in" }}>
          <QRCodeSVG value={p.qrUrl} size={300} level="M" fgColor="#000000" bgColor="#ffffff" />
        </div>
        <p style={{ fontSize: "16pt", fontWeight: 600, marginTop: "0.15in" }}>Scan to see what&rsquo;s on, and join free</p>
        <p style={{ fontSize: "10pt", marginTop: "0.3in", color: "#56645f" }}>Proud partner: {p.name}</p>
      </div>
      <div className="flex" style={{ borderTop: "1px dashed #56645f", height: "1.9in" }}>
        {tabs.map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center text-center"
            style={{ flex: 1, borderLeft: i ? "1px dashed #56645f" : "none", padding: "0.08in" }}
          >
            <QRCodeSVG value={p.qrUrl} size={80} level="M" fgColor="#000000" bgColor="#ffffff" />
            <p style={{ fontSize: "7pt", marginTop: "0.06in", lineHeight: 1.2 }}>Neighbors planning things. Scan to join.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlacardClient({ token }: { token: string }) {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState<Format>("counter");
  const [mode, setMode] = useState<"choose" | "mail" | "mailed" | "declined">("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stand, setStand] = useState(true);
  const [tent, setTent] = useState(false);
  const [cards, setCards] = useState("25");
  const [ship, setShip] = useState({ name: "", line1: "", line2: "", city: "", state: "NY", zip: "" });

  const load = useCallback(async () => {
    try {
      const p = (await Parse.Cloud.run("getPlacardPage", { token })) as Page;
      setPage(p);
      if (p.state === "ok" && p.mailRequest) setMode("mailed");
    } catch {
      setPage({ state: "unavailable" } as Page);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const print = async () => {
    Parse.Cloud.run("recordPlacardPrint", { token, format }).catch(() => {});
    window.print();
  };

  const mail = async () => {
    setError(null);
    setBusy(true);
    try {
      await Parse.Cloud.run("requestPlacardMail", {
        token,
        items: { stand: stand ? 1 : 0, tent: tent ? 1 : 0, cards: Number(cards) || 0 },
        shipTo: ship,
      });
      setMode("mailed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through. Try again?");
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    await Parse.Cloud.run("declinePlacard", { token }).catch(() => {});
    setMode("declined");
  };

  if (loading) {
    return (
      <Shell>
        <p className="text-[15px] text-zinc-500">Loading…</p>
      </Shell>
    );
  }
  if (!page || page.state !== "ok") {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-leaf-900">We couldn&rsquo;t find this one.</h1>
        <p className="mt-3 text-[15px] text-zinc-700">Try tapping the link again from Shawn&rsquo;s email, or just reply to it.</p>
      </Shell>
    );
  }

  return (
    <>
      {/* Print only the chosen card, at its real size, with no page margins. */}
      <style>{`
        @media print {
          @page { size: ${format === "counter" ? "4in 6in" : "8.5in 11in"}; margin: 0; }
          body * { visibility: hidden !important; }
          .placard-${format}, .placard-${format} * { visibility: visible !important; }
          .placard-${format} { position: fixed; left: 0; top: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <Shell>
        <div className="no-print">
          <p className="text-[13px] font-medium uppercase tracking-wide text-leaf-700">For {page.name}</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight text-leaf-900">A small card for your counter?</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-700">
            People who scan it land on the neighborhood calendar and can join in one tap. It names you as a partner. Print
            one now, have one mailed, or skip it.
          </p>

          {mode === "declined" ? (
            <p className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-[15px] text-zinc-700">
              No problem. If you change your mind, this link keeps working.
            </p>
          ) : mode === "mailed" ? (
            <p className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-[15px] text-zinc-700">
              Got it. Shawn will post it to you. You can still print one below in the meantime.
            </p>
          ) : null}

          <div className="mt-8 flex gap-2">
            {(["counter", "flyer"] as Format[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-[15px] font-medium ${
                  format === f ? "border-leaf-700 bg-leaf-800 text-white" : "border-zinc-300 bg-white text-zinc-800"
                }`}
              >
                {f === "counter" ? "Counter card (4×6)" : "Flyer with tear-off tabs"}
              </button>
            ))}
          </div>
          <button type="button" onClick={print} className="mt-3 w-full rounded-xl bg-leaf-800 px-4 py-3.5 text-[16px] font-semibold text-white hover:bg-leaf-900">
            Print it now
          </button>
          <p className="mt-2 text-[13px] text-zinc-500">Prints in black on white on any office printer. Choose &ldquo;Save as PDF&rdquo; to keep a copy.</p>
        </div>

        <div className="mt-8 overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-100 p-4">
          <div style={{ transform: format === "flyer" ? "scale(0.6)" : "none", transformOrigin: "top center", height: format === "flyer" ? "6.8in" : "auto" }}>
            {format === "counter" ? <CounterCard p={page} /> : <Flyer p={page} />}
          </div>
        </div>

        <div className="no-print mt-10">
          {mode === "choose" && page.canMail && (
            <button type="button" onClick={() => setMode("mail")} className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-[15px] font-medium text-zinc-800">
              Mail me one instead
            </button>
          )}
          {mode === "choose" && !page.canMail && (
            <p className="text-[13px] text-zinc-500">After your first night on the calendar, we can mail you a stand or table tent too.</p>
          )}
          {mode === "mail" && (
            <div className="space-y-3">
              <p className="text-[15px] font-medium text-zinc-800">What would you like?</p>
              <label className="flex items-center gap-2 text-[15px] text-zinc-700">
                <input type="checkbox" checked={stand} onChange={(e) => setStand(e.target.checked)} /> An acrylic stand card
              </label>
              <label className="flex items-center gap-2 text-[15px] text-zinc-700">
                <input type="checkbox" checked={tent} onChange={(e) => setTent(e.target.checked)} /> A table tent for the bar
              </label>
              <label className="flex items-center gap-2 text-[15px] text-zinc-700">
                Small register cards:
                <input inputMode="numeric" value={cards} onChange={(e) => setCards(e.target.value)} className={`${input} w-20`} />
                <span className="text-[13px] text-zinc-500">up to {page.maxCards}</span>
              </label>
              <input value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} placeholder="Name" className={input} />
              <input value={ship.line1} onChange={(e) => setShip({ ...ship, line1: e.target.value })} placeholder="Street address" className={input} />
              <input value={ship.line2} onChange={(e) => setShip({ ...ship, line2: e.target.value })} placeholder="Apt, suite (optional)" className={input} />
              <div className="flex gap-2">
                <input value={ship.city} onChange={(e) => setShip({ ...ship, city: e.target.value })} placeholder="City" className={input} />
                <input value={ship.state} onChange={(e) => setShip({ ...ship, state: e.target.value })} placeholder="State" className={`${input} w-20`} />
                <input value={ship.zip} onChange={(e) => setShip({ ...ship, zip: e.target.value })} placeholder="ZIP" inputMode="numeric" className={`${input} w-28`} />
              </div>
              {error && <p className="text-[14px] text-red-700">{error}</p>}
              <button type="button" onClick={mail} disabled={busy} className="w-full rounded-xl bg-leaf-800 px-4 py-3.5 text-[16px] font-semibold text-white disabled:opacity-40">
                {busy ? "Sending…" : "Mail it to me"}
              </button>
            </div>
          )}
          {mode === "choose" && (
            <div className="mt-6 text-center">
              <button type="button" onClick={decline} className="text-[14px] text-zinc-500 underline">
                Not now
              </button>
            </div>
          )}
        </div>
      </Shell>
    </>
  );
}
