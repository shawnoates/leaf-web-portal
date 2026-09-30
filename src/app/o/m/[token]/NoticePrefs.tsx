"use client";

/**
 * Where the merchant hears from Leaf: an email, an optional mobile for texts
 * (with explicit consent), and per-topic Email / Text switches. Controlled by
 * the parent so it saves with the main button; `standalone` adds its own Save
 * for the page after they've accepted.
 */

import { useState } from "react";
import Parse from "@/lib/parse-client";
import { Field, Toggle, formatPhone, input } from "./ui";

export type NoticeTopic = { key: string; label: string; detail: string };
export type Prefs = Record<string, { email: boolean; sms: boolean }>;
export type Notices = {
  topics: NoticeTopic[];
  prefs: Prefs;
  email: string;
  smsPhone: string;
  smsConsent: boolean;
  smsOptedOut: boolean;
};

export function noticePayload(n: Notices) {
  return { prefs: n.prefs, email: n.email, smsPhone: n.smsPhone, smsConsent: n.smsConsent };
}

export default function NoticePrefs({
  token,
  value,
  onChange,
  standalone = false,
}: {
  token: string;
  value: Notices;
  onChange: (n: Notices) => void;
  standalone?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const digits = value.smsPhone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  const canText = digits.length === 10 && value.smsConsent;

  const set = (patch: Partial<Notices>) => {
    setSaved(false);
    onChange({ ...value, ...patch });
  };
  const setTopic = (key: string, channel: "email" | "sms", on: boolean) =>
    set({ prefs: { ...value.prefs, [key]: { ...value.prefs[key], [channel]: on } } });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run("updateMerchantNotices", { token, ...noticePayload(value) })) as { notices: Notices };
      onChange(r.notices);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Email">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={value.email}
          onChange={(e) => set({ email: e.target.value })}
          placeholder="you@yourplace.com"
          className={input}
        />
      </Field>
      <Field label="Mobile for texts (optional)">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={formatPhone(value.smsPhone)}
          onChange={(e) => set({ smsPhone: e.target.value })}
          placeholder="(555) 555-5555"
          className={input}
        />
      </Field>
      {digits.length === 10 && (
        <label className="flex items-start gap-3 rounded-xl bg-stone-50 p-3.5">
          <input
            type="checkbox"
            checked={value.smsConsent}
            onChange={(e) => set({ smsConsent: e.target.checked })}
            className="mt-0.5 h-5 w-5 shrink-0 accent-leaf-800"
          />
          <span className="text-[13px] leading-snug text-stone-600">
            Text me about my Leaf nights at this number. Up to 4 msgs/wk. Msg &amp; data rates may apply. Reply HELP for help,
            STOP to opt out.
            {value.smsOptedOut && " You replied STOP earlier: text START to our number to turn texts back on."}
          </span>
        </label>
      )}

      <div className="overflow-hidden rounded-xl border border-stone-200">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 bg-stone-50 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-stone-500">
          <span>Tell me about</span>
          <span className="w-12 text-center">Email</span>
          <span className="w-12 text-center">Text</span>
        </div>
        {value.topics.map((t) => (
          <div key={t.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-t border-stone-100 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-stone-900">{t.label}</p>
              <p className="text-[13px] leading-snug text-stone-500">{t.detail}</p>
            </div>
            <Toggle label={`${t.label} by email`} on={value.prefs[t.key]?.email ?? true} onChange={(v) => setTopic(t.key, "email", v)} />
            <Toggle
              label={`${t.label} by text`}
              on={canText && (value.prefs[t.key]?.sms ?? false)}
              disabled={!canText}
              onChange={(v) => setTopic(t.key, "sms", v)}
            />
          </div>
        ))}
      </div>
      {!canText && <p className="text-[13px] text-stone-500">Add a mobile and tick the box to turn on texts.</p>}

      {standalone && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-12 rounded-xl bg-leaf-800 px-6 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
          {saved && <span className="text-[14px] text-leaf-700">Saved</span>}
          {error && <span className="text-[14px] text-red-600">{error}</span>}
        </div>
      )}
    </div>
  );
}
