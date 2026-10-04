"use client";

import { useEffect } from "react";
import { Check, Clock, Repeat, Users, Wallet, X } from "lucide-react";

/**
 * One-time introduction to peer-to-peer payments for the people who run a
 * calendar. Guests pay the host directly on Venmo, Cash App, PayPal or Zelle;
 * Leaf only keeps track. "Create a plan and collect" opens the plan drawer
 * with "Collect money" already on; price-per-spot or split is chosen there.
 */

const METHODS = ["Venmo", "Cash App", "PayPal", "Zelle"];
// Pickleball, to match the sample roster laid over it.
const PHOTO = { url: "/p2p-intro-pickleball.jpg", alt: "Friends cheering on a pickleball court at dusk" };

// The sample roster on the card: a court split six ways, four paid.
const SAMPLE = [
  { name: "Maya", paid: true },
  { name: "Jordan", paid: true },
  { name: "Ren", paid: true },
  { name: "Sam", paid: true },
  { name: "Alex", paid: false },
  { name: "Priya", paid: false },
];

export default function P2pIntroModal({
  onStart,
  onClose,
}: {
  onStart: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/45 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="p2p-intro-title"
        className="relative bg-white w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl md:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 p-1.5 rounded-full bg-white/80 text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* A real group, with what the host sees once guests start paying
            laid over its bottom edge. */}
        <div className="relative h-48">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTO.url} alt={PHOTO.alt} className="absolute inset-0 h-full w-full object-cover object-[center_40%] rounded-t-2xl" />
          <div className="absolute inset-0 rounded-t-2xl bg-gradient-to-t from-black/35 to-transparent" />
          <div className="absolute -bottom-8 right-5 w-[248px] rounded-xl bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
            <div className="flex items-baseline justify-between">
              <p className="text-[12px] font-semibold text-zinc-900">Tuesday pickleball</p>
              <p className="text-[11px] text-zinc-500">$30 each</p>
            </div>
            <div className="mt-2 h-1 rounded-full bg-zinc-100 overflow-hidden">
              <div className="h-full w-2/3 rounded-full bg-emerald-500" />
            </div>
            <ul className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1">
              {SAMPLE.map((g) => (
                <li key={g.name} className="flex items-center gap-1 text-[11px]">
                  {g.paid ? (
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="w-2 h-2" strokeWidth={3.5} />
                    </span>
                  ) : (
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-dashed border-amber-400 text-amber-500">
                      <Clock className="w-2 h-2" />
                    </span>
                  )}
                  <span className={g.paid ? "text-zinc-800" : "text-zinc-400"}>{g.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="px-6 pt-12 pb-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">New</p>
          <h2 id="p2p-intro-title" className="mt-1 text-lg font-semibold text-zinc-900">
            Collect money for plans, with no fees
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-zinc-600">
            Guests pay you directly on {METHODS.join(", ").replace(/, (?=[^,]*$)/, " or ")}. Leaf tracks who&rsquo;s paid and never holds the money.
          </p>

          <ul className="mt-3.5 space-y-2">
            <Point icon={<Wallet className="w-3.5 h-3.5" />}>A price per spot, or split a shared cost</Point>
            <Point icon={<Users className="w-3.5 h-3.5" />}>Spots are held while guests pay, with reminders</Point>
            <Point icon={<Repeat className="w-3.5 h-3.5" />}>Dropouts covered: the next guest pays them back</Point>
          </ul>

          <button
            onClick={onStart}
            className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            Create a plan and collect
          </button>
          <button
            onClick={onClose}
            className="mt-1 w-full py-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

function Point({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 text-[13px] text-zinc-800">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
        {icon}
      </span>
      {children}
    </li>
  );
}
