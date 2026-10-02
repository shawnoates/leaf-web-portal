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

const FIELDS: { key: keyof PayHandles; label: string; placeholder: string; inputMode?: "email" | "text" }[] = [
  { key: "venmo", label: "Venmo", placeholder: "@username" },
  { key: "cashapp", label: "Cash App", placeholder: "$cashtag" },
  { key: "paypal", label: "PayPal.me", placeholder: "paypal.me/name" },
  { key: "zelle", label: "Zelle", placeholder: "Email or phone at your bank", inputMode: "email" },
];

export default function PayHandlesForm({
  initial,
  onSaved,
  onCancel,
  saveLabel = "Save",
}: {
  initial?: PayHandles | null;
  onSaved: (handles: PayHandles) => void;
  onCancel?: () => void;
  saveLabel?: string;
}) {
  const [v, setV] = useState<PayHandles>({
    venmo: initial?.venmo ? `@${initial.venmo}` : "",
    cashapp: initial?.cashapp ? `$${initial.cashapp}` : "",
    paypal: initial?.paypal || "",
    zelle: initial?.zelle || "",
    zelleName: initial?.zelleName || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
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
          <input
            value={v[f.key] || ""}
            placeholder={f.placeholder}
            inputMode={f.inputMode}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setV((p) => ({ ...p, [f.key]: e.target.value }))}
          />
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
.phf-row input{border:1px solid rgba(0,0,0,.15);border-radius:8px;padding:9px 11px;font:inherit;font-size:14px;color:#17150f;background:#fff;min-width:0}
.phf-row input:focus{outline:none;border-color:#17150f}
.phf-err{margin:0;color:#b91c1c;font-size:12px}
.phf-actions{display:flex;gap:8px;margin-top:4px}
.phf-btn{border-radius:8px;padding:9px 16px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;border:1px solid #17150f}
.phf-btn.primary{background:#17150f;color:#fff}
.phf-btn.ghost{background:#fff;color:#17150f;border-color:rgba(0,0,0,.18)}
.phf-btn:disabled{opacity:.55;cursor:default}
`;
