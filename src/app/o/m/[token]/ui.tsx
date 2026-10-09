/**
 * Building blocks for the merchant page. Warm and editorial: a cream page,
 * white cards, a serif for headlines, Manrope for everything else. Phone-first:
 * 16px inputs so iOS never zooms, 48px tap targets, one column.
 */

import type { ReactNode } from "react";

export const CREAM = "bg-[#f6f2ea]";

export const input =
  "h-12 w-full rounded-xl border border-stone-300 bg-white px-3.5 text-[16px] text-stone-900 placeholder:text-stone-400 focus:border-leaf-600 focus:outline-none focus:ring-4 focus:ring-leaf-100";

export const textarea =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-[16px] leading-snug text-stone-900 placeholder:text-stone-400 focus:border-leaf-600 focus:outline-none focus:ring-4 focus:ring-leaf-100";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold uppercase tracking-[0.06em] text-stone-500">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[13px] leading-snug text-stone-500">{hint}</span>}
    </label>
  );
}

/** One step: a white card with a small counter and a serif title. */
export function Section({ n, total, id, title, sub, children }: { n: number; total: number; id?: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(28,25,23,0.06),0_8px_24px_-12px_rgba(28,25,23,0.12)]">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-600">
        Step {n} of {total}
      </p>
      <h2 className="mt-1 font-fm-serif text-[28px] leading-[1.05] text-stone-900">{title}</h2>
      {sub && <p className="mt-1.5 text-[15px] leading-snug text-stone-600">{sub}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

export function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-12 flex-1 rounded-xl border px-3 text-[15px] font-semibold transition-colors ${
        on ? "border-leaf-800 bg-leaf-800 text-white" : "border-stone-300 bg-white text-stone-800 active:bg-stone-50"
      }`}
    >
      {children}
    </button>
  );
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-35 ${on ? "bg-leaf-700" : "bg-stone-300"}`}
    >
      <span className={`absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className={`min-h-dvh ${CREAM} font-fm-sans text-stone-900`}>
      <main className="mx-auto max-w-lg px-4 pb-44 pt-5">{children}</main>
    </div>
  );
}

/** The business's own Google photo, under the logo, with the credit Google requires. */
export function BusinessPhoto({ url, credit, name }: { url?: string | null; credit?: { name: string; uri: string } | null; name: string }) {
  if (!url) return null;
  return (
    <figure className="mt-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={name} className="h-44 w-full rounded-2xl object-cover sm:h-56" />
      {credit?.name && (
        <figcaption className="mt-1 px-1 text-right text-[11px] text-stone-400">
          Photo:{" "}
          {credit.uri ? (
            <a href={credit.uri} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {credit.name}
            </a>
          ) : (
            credit.name
          )}{" "}
          on Google
        </figcaption>
      )}
    </figure>
  );
}

export function Brand({ neighborhood }: { neighborhood?: string }) {
  return (
    <div className="flex items-center justify-between px-1">
      {/* The brand logo, as on the rest of the site; it goes home. */}
      <a href="https://www.joinleaf.com" aria-label="Leaf home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/leaf-logo-black.png" alt="Leaf" className="h-7 w-auto" />
      </a>
      {neighborhood && (
        <span className="rounded-full border border-leaf-200 bg-white/70 px-3 py-1 text-[12px] font-semibold text-leaf-700">{neighborhood}</span>
      )}
    </div>
  );
}

export function Closed({ title, body, children, neighborhood }: { title: string; body: string; children?: ReactNode; neighborhood?: string }) {
  return (
    <Shell>
      <Brand neighborhood={neighborhood} />
      <div className="mt-10 rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="font-fm-serif text-[32px] leading-[1.05] text-stone-900">{title}</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-stone-600">{body}</p>
      </div>
      {children}
    </Shell>
  );
}

export function dollars(cents: number) {
  const d = cents / 100;
  return `$${Number.isInteger(d) ? d : d.toFixed(2)}`;
}

/** (212) 555-0100 as they type. */
export function formatPhone(v: string) {
  let d = v.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
