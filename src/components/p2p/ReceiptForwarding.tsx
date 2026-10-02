"use client";

import { useState } from "react";

export type Inbound = { address: string; forwardCode: string | null; lastReceiptAt: string | null };

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Forward Venmo / Cash App / PayPal / bank receipts to a private address and
 * they're matched to guests (server: handleP2pReceipt). Gmail can do it on
 * its own with a filter; Gmail first mails the address a code, which the
 * server catches and shows here.
 */
export default function ReceiptForwarding({ inbound }: { inbound: Inbound }) {
  const [open, setOpen] = useState(Boolean(inbound.forwardCode));
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inbound.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked; the address is on screen */ }
  };
  return (
    <div className="ph-fwd">
      <style>{CSS}</style>
      <button className="ph-fwd-h" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>Match receipts automatically</span>
        <span className="ph-muted ph-small">{inbound.lastReceiptAt ? `last receipt ${when(inbound.lastReceiptAt)}` : open ? "Hide" : "Set up"}</span>
      </button>
      {inbound.forwardCode && (
        <p className="ph-fwd-code">Gmail&apos;s confirmation code: <b>{inbound.forwardCode}</b> — enter it in Gmail to finish.</p>
      )}
      {open && (
        <div className="ph-fwd-body">
          <p className="ph-muted">
            Forward your Venmo, Cash App, PayPal or bank payment emails here. A payment with the guest&apos;s
            LEAF code and the right amount confirms itself; anything less sure shows up for you to confirm.
          </p>
          <div className="ph-fwd-addr">
            <code>{inbound.address}</code>
            <button className="ph-link" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <ol className="ph-fwd-steps">
            <li>In Gmail, open Settings → Forwarding and POP/IMAP → Add a forwarding address, and paste this one.</li>
            <li>Gmail sends a code here; it shows up on this page (and we&apos;ll text it to you). Enter it in Gmail.</li>
            <li>Make a filter for <code>from:(venmo.com OR cash.app OR paypal.com OR zelle)</code> and set it to forward to this address.</li>
          </ol>
          <p className="ph-muted ph-small">Not on Gmail? Forward a receipt by hand whenever one comes in. Leaf keeps only the amount, code and name — never the email.</p>
        </div>
      )}
    </div>
  );
}

// Scoped by class: used on /pay/<planId> and /pay/handles.
const CSS = `
.ph-fwd{background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:14px;padding:4px 16px}
.ph-fwd-h{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;border:0;background:none;padding:12px 0;font:inherit;font-size:14px;font-weight:600;color:#17150f;cursor:pointer;text-align:left}
.ph-fwd-code{margin:0 0 10px !important;background:#f3f7f5;color:#253a33;border-radius:8px;padding:8px 10px;font-size:13px}
.ph-fwd-body{display:grid;gap:10px;padding-bottom:14px}
.ph-fwd-addr{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#faf9f7;border-radius:8px;padding:9px 11px}
.ph-fwd-addr code{font-family:var(--font-geist-mono,ui-monospace,monospace);font-size:13px;overflow-wrap:anywhere}
.ph-fwd-steps{margin:0;padding-left:18px;display:grid;gap:6px;font-size:12.5px;color:#6f6a5f}
.ph-fwd-steps code{font-family:var(--font-geist-mono,ui-monospace,monospace);font-size:11.5px;background:#faf9f7;padding:1px 4px;border-radius:4px}
.ph-fwd .ph-muted{color:#6f6a5f;font-size:13px;margin:0}
.ph-fwd .ph-small{font-size:12px}
.ph-fwd .ph-link{border:0;background:none;color:#8b8578;font:inherit;font-size:12px;text-decoration:underline;cursor:pointer;padding:0}
.ph-fwd p{margin:0}
`;
