"use client";

/**
 * Host roster intake — /hosts/apply
 *
 * Mobile first, and that is not a style note. Most of these people are filling
 * this out on a phone from a Craigslist relay email, one-handed, probably not
 * at a desk. So: one column always, real labels above every field, `capture`
 * on the photo input so the camera is one tap, `inputMode` set on the two
 * fields where the wrong keyboard costs a retype, and no step wizard — a
 * single scrollable page you can see the end of.
 *
 * Fields deliberately absent: age beyond the 21+ attestation, date of birth,
 * gender, marital status, race. NYC's Human Rights Law covers independent
 * contractors, and a structured field capturing a protected class in a table
 * you filter on when handing out paid work is a liability with no matching
 * upside. The optional "good fit for" question collects the same useful signal
 * as volunteered self-description instead. Do not add them back.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Parse from "@/lib/parse-client";
import { processImageFile, IMAGE_ACCEPT } from "@/lib/image-utils";

type NeighborhoodOption = {
  slug: string;
  name: string;
  displayLabel: string;
  hasLiveCalendar: boolean;
};

type NeighborhoodGroup = {
  parentArea: string;
  liveCount: number;
  neighborhoods: NeighborhoodOption[];
};

type Options = {
  neighborhoodGroups: NeighborhoodGroup[];
  availability: string[];
  languageSuggestions: string[];
};

const AVAILABILITY_LABELS: Record<string, string> = {
  weeknights: "Weeknights",
  weekends: "Weekends",
  daytime: "Daytime",
};

// ── Shared field chrome ────────────────────────────────────────────────────

function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[15px] font-medium text-leaf-900">
        {label}
        {optional && (
          <span className="ml-1.5 font-normal text-zinc-500">Optional</span>
        )}
      </label>
      {hint && <p className="text-[13px] leading-snug text-zinc-500">{hint}</p>}
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-[16px] " +
  "text-leaf-900 placeholder:text-zinc-400 outline-none " +
  "focus:border-leaf-600 focus:ring-2 focus:ring-leaf-600/20";

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        "rounded-full border px-3 py-1.5 text-[14px] transition-colors " +
        (selected
          ? "border-leaf-700 bg-leaf-700 text-white"
          : "border-zinc-300 bg-white text-leaf-900 hover:border-leaf-500")
      }
    >
      {children}
    </button>
  );
}

export default function HostApplyForm() {
  const [options, setOptions] = useState<Options | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [is21Plus, setIs21Plus] = useState<boolean | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [neighborhoodsOther, setNeighborhoodsOther] = useState("");
  const [availability, setAvailability] = useState<string[]>([]);
  const [availabilityNotes, setAvailabilityNotes] = useState("");
  const [bio, setBio] = useState("");
  const [fitNotes, setFitNotes] = useState("");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [languagesOther, setLanguagesOther] = useState("");
  const [experience, setExperience] = useState("");
  const [extraNotes, setExtraNotes] = useState("");

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  // Honeypot. Hidden from people and from screen readers; bots fill it and get
  // a cheerful success page. Never shown, never focusable.
  const [website, setWebsite] = useState("");

  const [hoodFilter, setHoodFilter] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = (await Parse.Cloud.run("listHostApplicationOptions")) as Options;
        setOptions(r);
      } catch {
        // A failed picklist must not block the form — the freeform
        // "somewhere else" box is a complete answer on its own.
        setOptions({
          neighborhoodGroups: [],
          availability: ["weeknights", "weekends", "daytime"],
          languageSuggestions: ["English", "Spanish"],
        });
      }
    })();
  }, []);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  const filteredGroups = useMemo(() => {
    if (!options) return [];
    const q = hoodFilter.trim().toLowerCase();
    if (!q) return options.neighborhoodGroups;
    return options.neighborhoodGroups
      .map((g) => ({
        ...g,
        neighborhoods: g.neighborhoods.filter((n) =>
          n.name.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.neighborhoods.length > 0);
  }, [options, hoodFilter]);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    setError(null);
    try {
      // Handles HEIC (every recent iPhone shoots it and browsers can't render
      // it), downscales, and hands back base64 — the same helper the create-plan
      // modal uses, so there is one image path in this app, not two.
      const { preview, base64 } = await processImageFile(file);
      setPhotoPreview(preview);
      setPhotoBase64(base64);
    } catch {
      setError("That photo wouldn't load. Try another one.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!photoBase64) {
      setError("Add a photo so attendees can find you when they walk in.");
      return;
    }
    if (is21Plus === null) {
      setError("Let us know whether you're 21 or over.");
      return;
    }
    if (neighborhoods.length === 0 && !neighborhoodsOther.trim()) {
      setError("Pick at least one neighborhood, or tell us where else you can get to.");
      return;
    }
    if (availability.length === 0) {
      setError("Tell us when you're generally free.");
      return;
    }
    if (smsConsent && !phone.trim()) {
      setError("Add a mobile number, or untick the text-me box.");
      return;
    }

    const allLanguages = [...languages];
    for (const extra of languagesOther.split(",")) {
      const t = extra.trim();
      if (t && !allLanguages.some((l) => l.toLowerCase() === t.toLowerCase())) {
        allLanguages.push(t);
      }
    }

    setSubmitting(true);
    try {
      await Parse.Cloud.run("submitHostApplication", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        smsConsent,
        is21Plus,
        neighborhoods,
        neighborhoodsOther: neighborhoodsOther.trim() || undefined,
        availability,
        availabilityNotes: availabilityNotes.trim() || undefined,
        bio: bio.trim(),
        fitNotes: fitNotes.trim() || undefined,
        languages: allLanguages,
        experience: experience.trim(),
        extraNotes: extraNotes.trim() || undefined,
        photoBase64,
        photoMimeType: "image/jpeg",
        website, // honeypot
      });
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Try again in a moment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Confirmation ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16">
        <div className="rounded-2xl border border-leaf-200 bg-leaf-50 p-6">
          <h1 className="text-xl font-semibold text-leaf-900">
            You&rsquo;re on the list.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-leaf-800">
            Thanks{firstName ? `, ${firstName}` : ""}. We&rsquo;ve sent a
            confirmation to {email}. When a night in your neighborhood needs a
            host, we&rsquo;ll get in touch.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-leaf-800">
            Nothing else to do for now.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-10 pb-24">
      <header className="mb-8">
        <h1 className="text-[26px] font-semibold leading-tight text-leaf-900">
          Host a night with Leaf
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
          We run neighborhood events and we need people who are good in a room
          full of strangers. It&rsquo;s contract work, paid per night.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-7" noValidate>
        {/* Honeypot — off-screen, hidden from AT, excluded from tab order. */}
        <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              className={inputClass}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
            />
          </Field>
          <Field label="Last name">
            <input
              className={inputClass}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              required
            />
          </Field>
        </div>

        <Field
          label="Photo"
          hint="Attendees see this so they can find you when they walk in. A clear photo of your face is all this needs to be."
        >
          <div className="flex items-center gap-4">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt="Your photo"
                className="h-20 w-20 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-300 bg-zinc-50 text-[12px] text-zinc-400">
                No photo
              </div>
            )}
            <label className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-[15px] font-medium text-leaf-900 hover:border-leaf-500">
              {photoBusy ? "Loading…" : photoPreview ? "Change photo" : "Add photo"}
              <input
                type="file"
                // `capture` opens the camera directly on a phone; desktop
                // browsers ignore it and show the file picker.
                accept={IMAGE_ACCEPT}
                capture="user"
                className="hidden"
                onChange={onPhotoChange}
              />
            </label>
          </div>
        </Field>

        <Field label="Email" hint="This is how we'll usually reach you.">
          <input
            className={inputClass}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>

        <Field label="Mobile number" optional>
          <input
            className={inputClass}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(347) 555-0110"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <label className="mt-3 flex items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-leaf-700"
              checked={smsConsent}
              onChange={(e) => setSmsConsent(e.target.checked)}
            />
            <span className="text-[14px] leading-snug text-zinc-700">
              Text me when a night needs a host. Standard rates apply, reply
              STOP to stop.
            </span>
          </label>
        </Field>

        <Field label="Are you 21 or over?" hint="Most of these are in bars.">
          <div className="flex gap-2">
            <Chip selected={is21Plus === true} onClick={() => setIs21Plus(true)}>
              Yes
            </Chip>
            <Chip selected={is21Plus === false} onClick={() => setIs21Plus(false)}>
              No
            </Chip>
          </div>
        </Field>

        <Field label="Neighborhoods you can get to on a weeknight">
          {options && options.neighborhoodGroups.length > 0 && (
            <>
              <input
                className={inputClass + " mb-3"}
                placeholder="Filter neighborhoods"
                value={hoodFilter}
                onChange={(e) => setHoodFilter(e.target.value)}
              />
              <div className="max-h-72 space-y-4 overflow-y-auto rounded-lg border border-zinc-200 p-3">
                {filteredGroups.map((g) => (
                  <div key={g.parentArea}>
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
                      {g.parentArea}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {g.neighborhoods.map((n) => (
                        <Chip
                          key={n.slug}
                          selected={neighborhoods.includes(n.slug)}
                          onClick={() =>
                            toggle(neighborhoods, setNeighborhoods, n.slug)
                          }
                        >
                          {n.name}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ))}
                {filteredGroups.length === 0 && (
                  <p className="text-[14px] text-zinc-500">
                    No matches. Use the box below instead.
                  </p>
                )}
              </div>
            </>
          )}
          <input
            className={inputClass + " mt-3"}
            placeholder="Somewhere else? Tell us where."
            value={neighborhoodsOther}
            onChange={(e) => setNeighborhoodsOther(e.target.value)}
          />
        </Field>

        <Field label="When are you generally free?">
          <div className="flex flex-wrap gap-2">
            {(options?.availability || []).map((slot) => (
              <Chip
                key={slot}
                selected={availability.includes(slot)}
                onClick={() => toggle(availability, setAvailability, slot)}
              >
                {AVAILABILITY_LABELS[slot] || slot}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Anything I should know about your schedule?" optional>
          <textarea
            className={inputClass}
            rows={2}
            value={availabilityNotes}
            onChange={(e) => setAvailabilityNotes(e.target.value)}
          />
        </Field>

        <Field
          label="About you"
          hint="Two or three sentences. This is shown to the group before the event, next to your photo. Write it the way you would introduce yourself."
        >
          <textarea
            className={inputClass}
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            required
          />
        </Field>

        <Field
          label="Any kind of group you'd be a particularly good fit for?"
          optional
          hint="Totally optional. Some of our groups have a specific character to them, a book club, a parents' group, a running crew. If there is something you would be a natural at, say so here."
        >
          <textarea
            className={inputClass}
            rows={3}
            value={fitNotes}
            onChange={(e) => setFitNotes(e.target.value)}
          />
        </Field>

        <Field label="Languages you're comfortable hosting in" optional>
          <div className="flex flex-wrap gap-2">
            {(options?.languageSuggestions || []).map((lang) => (
              <Chip
                key={lang}
                selected={languages.includes(lang)}
                onClick={() => toggle(languages, setLanguages, lang)}
              >
                {lang}
              </Chip>
            ))}
          </div>
          <input
            className={inputClass + " mt-3"}
            placeholder="Another language? Separate with commas."
            value={languagesOther}
            onChange={(e) => setLanguagesOther(e.target.value)}
          />
        </Field>

        <Field label="When were you last responsible for a group of strangers?">
          <textarea
            className={inputClass}
            rows={4}
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            required
          />
        </Field>

        <Field label="Anything else?" optional>
          <textarea
            className={inputClass}
            rows={3}
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
          />
        </Field>

        <div className="rounded-xl bg-zinc-50 p-4 text-[14px] leading-relaxed text-zinc-700">
          <p className="font-medium text-leaf-900">What happens next</p>
          <p className="mt-1.5">
            You go on a list. When a night in your neighborhood needs a host, we
            get in touch. It is contract work, 1099, paid the same night or the
            next morning. Your photo and your description are shown to the
            people attending that event. Nothing else is shared with anyone.
          </p>
        </div>

        {error && (
          <div
            ref={errorRef}
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || photoBusy}
          className="w-full rounded-lg bg-leaf-800 px-5 py-3.5 text-[16px] font-medium text-white transition-colors hover:bg-leaf-900 disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Put me on the list"}
        </button>
      </form>
    </main>
  );
}
