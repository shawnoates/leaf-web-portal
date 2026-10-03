"use client";

/**
 * Where a host gets paid back (server: setMyPayHandles in cloud/p2p-payment.js).
 *
 * Any of Venmo / Cash App / PayPal / Zelle, at least one. Guests pick the app
 * they already have, so more is better. Zelle needs the name on the bank
 * account: it's what the guest's bank shows before a send that can't be
 * undone. The server normalizes pasted links ("cash.app/$x", "paypal.me/x").
 *
 * Saved to the host's profile once and reused for every plan.
 */

import { useState } from "react";
import Parse from "@/lib/parse-client";

export type PayHandles = {
  venmo?: string;
  cashapp?: string;
  paypal?: string;
  zelle?: string;
  zelleName?: string;
};

export function describeHandles(h: PayHandles | null | undefined): string {
  if (!h) return "";
  const parts: string[] = [];
  if (h.venmo) parts.push(`Venmo @${h.venmo}`);
  if (h.cashapp) parts.push(`Cash App $${h.cashapp}`);
  if (h.paypal) parts.push(`PayPal ${h.paypal}`);
  if (h.zelle) parts.push("Zelle");
  return parts.join(" · ");
}

/**
 * A US phone number as typed, shown "479-747-4128". Anything with a letter or
 * "@" is an email (Zelle takes either) and is left alone. A leading 1 / +1 is
 * dropped; the server keeps the last ten digits either way.
 */
export function formatZelle(input: string): string {
  if (/[a-z@]/i.test(input)) return input.trim();
  let d = input.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

// Each handle is typed without its fixed prefix (shown beside the box); a
// pasted link or a typed prefix is stripped as it comes in.
const FIELDS: {
  key: keyof PayHandles;
  label: string;
  prefix?: string;
  placeholder: string;
  inputMode?: "email" | "text" | "tel";
  clean: (s: string) => string;
}[] = [
  { key: "venmo", label: "Venmo", prefix: "@", placeholder: "username",
    clean: (s) => s.replace(/^\s*(https?:\/\/)?(www\.)?venmo\.com\/(u\/)?/i, "").replace(/^@+/, "").replace(/\s/g, "") },
  { key: "cashapp", label: "Cash App", prefix: "$", placeholder: "cashtag",
    clean: (s) => s.replace(/^\s*(https?:\/\/)?(www\.)?cash\.app\//i, "").replace(/^\$+/, "").replace(/\s/g, "") },
  { key: "paypal", label: "PayPal", prefix: "paypal.me/", placeholder: "name",
    clean: (s) => s.replace(/^\s*(https?:\/\/)?(www\.)?paypal\.me\//i, "").replace(/\/.*$/, "").replace(/\s/g, "") },
  { key: "zelle", label: "Zelle", placeholder: "Phone or email at your bank", inputMode: "email", clean: formatZelle },
];

export default function PayHandlesForm({
  initial,
  onSaved,
  onCancel,
  saveLabel = "Save",
  onSubmit,
}: {
  initial?: PayHandles | null;
  onSaved: (handles: PayHandles) => void;
  onCancel?: () => void;
  saveLabel?: string;
  /** Instead of saving to the signed-in account: hand the values back (a
   *  roster host accepting by link has no session; the server checks them
   *  when the offer is accepted). */
  onSubmit?: (values: PayHandles) => void;
}) {
  const [v, setV] = useState<PayHandles>({
    venmo: initial?.venmo || "",
    cashapp: initial?.cashapp || "",
    paypal: initial?.paypal || "",
    zelle: initial?.zelle ? formatZelle(initial.zelle) : "",
    zelleName: initial?.zelleName || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (onSubmit) {
      const has = ["venmo", "cashapp", "paypal", "zelle"].some((k) => String(v[k as keyof PayHandles] || "").trim());
      if (!has) { setError("Add at least one way to get paid."); return; }
      if (v.zelle?.trim() && !v.zelleName?.trim()) { setError("Add the name on your bank account so guests can check it in Zelle."); return; }
      onSubmit(v);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run("setMyPayHandles", v)) as { handles: PayHandles };
      onSaved(r.handles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="phf">
      <style>{CSS}</style>
      <p className="phf-lead">How should guests pay you? Add any you use — they&apos;ll pick the app they have.</p>
      {FIELDS.map((f) => (
        <label key={f.key} className="phf-row">
          <span>{f.label}</span>
          <div className="phf-box">
            {f.prefix && <b aria-hidden="true">{f.prefix}</b>}
            <input
              value={v[f.key] || ""}
              placeholder={f.placeholder}
              inputMode={f.inputMode}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={f.prefix ? `${f.label} (${f.prefix}…)` : f.label}
              onChange={(e) => setV((p) => ({ ...p, [f.key]: f.clean(e.target.value) }))}
            />
          </div>
        </label>
      ))}
      {v.zelle?.trim() && (
        <label className="phf-row">
          <span>Name on bank account</span>
          <input
            value={v.zelleName || ""}
            placeholder="As your bank shows it"
            onChange={(e) => setV((p) => ({ ...p, zelleName: e.target.value }))}
          />
        </label>
      )}
      {error && <p className="phf-err">{error}</p>}
      <div className="phf-actions">
        <button type="button" className="phf-btn primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : saveLabel}
        </button>
        {onCancel && (
          <button type="button" className="phf-btn ghost" disabled={busy} onClick={onCancel}>Cancel</button>
        )}
      </div>
    </div>
  );
}

const CSS = `
.phf{display:grid;gap:10px;font-size:13px;color:#17150f;text-align:left}
.phf-lead{margin:0;color:#6f6a5f;font-size:12.5px}
.phf-row{display:grid;gap:4px}
.phf-row>span{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#8b8578}
.phf-row input{border:1px solid rgba(0,0,0,.15);border-radius:8px;padding:9px 11px;font:inherit;font-size:14px;color:#17150f;background:#fff;min-width:0;width:100%}
.phf-row input:focus{outline:none;border-color:#17150f}
.phf-box{display:flex;align-items:center;border:1px solid rgba(0,0,0,.15);border-radius:8px;background:#fff;padding-left:11px}
.phf-box:focus-within{border-color:#17150f}
.phf-box b{font-weight:400;color:#8b8578;font-size:14px;white-space:nowrap}
.phf-box input{border:0;padding-left:2px;border-radius:8px}
.phf-box input:focus{border:0}
.phf-box:not(:has(b)) input{padding-left:0}
.phf-err{margin:0;color:#b91c1c;font-size:12px}
.phf-actions{display:flex;gap:8px;margin-top:4px}
.phf-btn{border-radius:8px;padding:9px 16px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;border:1px solid #17150f}
.phf-btn.primary{background:#17150f;color:#fff}
.phf-btn.ghost{background:#fff;color:#17150f;border-color:rgba(0,0,0,.18)}
.phf-btn:disabled{opacity:.55;cursor:default}
`;
