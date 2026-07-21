"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Parse from "@/lib/parse-client";
import CityAutocomplete from "@/components/CityAutocomplete";
import SettingsSwitch from "@/components/SettingsSwitch";
import { IMAGE_ACCEPT, processImageFile } from "@/lib/image-utils";
import {
  ArrowLeft,
  ChevronDown,
  ImagePlus,
} from "lucide-react";

// Per-calendar edit page. Replaces the modal that lived on the dashboard
// once the option list grew past what a modal could reasonably hold.
// Loads the same getOrgDashboard shape the dashboard uses, pins to the
// target calendar, and calls the same cloud mutations (updateCalendar,
// setCalendarMerchantEventPolicy, listCalendarEventApprovals, etc.).

interface CalendarEntry {
  objectId: string;
  name: string;
  description: string;
  shareId: string;
  city: string;
  isPrimary: boolean;
  role: "Owner" | "Host";
  calendarImage: string | null;
  hideVenueUntilRsvp: boolean;
  requireApprovalDefault: boolean;
  allowFollowersToHost: boolean;
  isPrivate: boolean;
  hidePlanIdeas: boolean;
  hideCustomPlans: boolean;
  hideDeals: boolean;
  merchantEventsOptOut: boolean;
  merchantEventsRequireApproval: boolean;
  isConciergeServiced?: boolean;
}

interface DashboardShape {
  objectId: string;
  name: string;
  tier: string;
  isOwner: boolean;
  calendars: CalendarEntry[];
}

interface EventApproval {
  objectId: string;
  eventTitle: string;
  businessName: string | null;
  eventDate: string | null;
}

export default function EditCalendarPage() {
  const params = useParams<{ calendarId: string; targetId: string }>();
  const orgId = params.calendarId;
  const targetId = params.targetId;
  const router = useRouter();

  const [dashboard, setDashboard] = useState<DashboardShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state — mirrors the fields the old modal owned.
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [citySelected, setCitySelected] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const [hideVenue, setHideVenue] = useState(true);
  const [requireApprovalDefault, setRequireApprovalDefault] = useState(false);
  const [allowFollowersToHost, setAllowFollowersToHost] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [hidePlanIdeas, setHidePlanIdeas] = useState(false);
  const [hideCustomPlans, setHideCustomPlans] = useState(false);
  const [hideDeals, setHideDeals] = useState(false);

  // Per-calendar merchant (business events) policy — moved off Settings.
  const [merchantOptOut, setMerchantOptOut] = useState(false);
  const [merchantRequireApproval, setMerchantRequireApproval] = useState(false);
  const [merchantSaving, setMerchantSaving] = useState(false);

  const [approvals, setApprovals] = useState<EventApproval[]>([]);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);

  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const originalSlugRef = useRef<string>("");
  const slugTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Concierge — org-level plan; one calendar is "serviced" at a time. The
  // owner can move it here from the edit page (with a confirmation).
  const [confirmConcierge, setConfirmConcierge] = useState(false);
  const [settingConcierge, setSettingConcierge] = useState(false);

  const targetCalendar =
    dashboard?.calendars.find((c) => c.objectId === targetId) || null;
  const isConciergeOrg = dashboard?.tier === "concierge";
  const isServicedHere = targetCalendar?.isConciergeServiced === true;
  const currentServicedName =
    dashboard?.calendars.find((c) => c.isConciergeServiced)?.name || null;

  async function handleAddConcierge() {
    setSettingConcierge(true);
    try {
      await Parse.Cloud.run("setConciergeServicedCalendar", {
        orgId,
        calendarId: targetId,
      });
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              calendars: prev.calendars.map((c) => ({
                ...c,
                isConciergeServiced: c.objectId === targetId,
              })),
            }
          : prev
      );
      setConfirmConcierge(false);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to update concierge calendar."
      );
    } finally {
      setSettingConcierge(false);
    }
  }

  const canManageMerchant = targetCalendar?.role === "Owner";
  const isPrimary = targetCalendar?.isPrimary ?? false;
  const canDelete = targetCalendar && !isPrimary && targetCalendar.role === "Owner";
  const canMakePrimary = canDelete;

  const hydrateFromCalendar = useCallback((cal: CalendarEntry) => {
    setName(cal.name);
    setDescription(cal.description || "");
    setSlug(cal.shareId || "");
    originalSlugRef.current = cal.shareId || "";
    setSlugAvailable(null);
    setCity(cal.city || "");
    setCitySelected(false);
    setLat(null);
    setLng(null);
    setImagePreview(cal.calendarImage || null);
    setImageBase64(null);
    setRemoveImage(false);
    setHideVenue(cal.hideVenueUntilRsvp !== false);
    setRequireApprovalDefault(cal.requireApprovalDefault === true);
    setAllowFollowersToHost(cal.allowFollowersToHost !== false);
    setIsPrivate(cal.isPrivate || false);
    setHidePlanIdeas(cal.hidePlanIdeas || false);
    setHideCustomPlans(cal.hideCustomPlans || false);
    setHideDeals(cal.hideDeals || false);
    setMerchantOptOut(cal.merchantEventsOptOut === true);
    setMerchantRequireApproval(cal.merchantEventsRequireApproval === true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = (await Parse.Cloud.run("getOrgDashboard", {
          calendarId: orgId,
        })) as DashboardShape;
        if (cancelled) return;
        setDashboard(result);
        const cal = result.calendars.find((c) => c.objectId === targetId);
        if (!cal) {
          setLoadError("Calendar not found or you don't have access.");
        } else {
          hydrateFromCalendar(cal);
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : "Failed to load calendar."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, targetId, hydrateFromCalendar]);

  // Load pending business-event approvals for THIS calendar (not the org's
  // primary). Owner-only; failure = leave empty list.
  useEffect(() => {
    if (!canManageMerchant) return;
    (async () => {
      try {
        const r = (await Parse.Cloud.run("listCalendarEventApprovals", {
          calendarId: targetId,
        })) as { approvals?: EventApproval[] };
        setApprovals(r.approvals || []);
      } catch {
        /* not permitted / none */
      }
    })();
  }, [canManageMerchant, targetId]);

  const decideApproval = async (approvalId: string, approve: boolean) => {
    setApprovalBusyId(approvalId);
    try {
      await Parse.Cloud.run("decideCalendarEventApproval", {
        approvalId,
        approve,
      });
      setApprovals((prev) => prev.filter((a) => a.objectId !== approvalId));
    } finally {
      setApprovalBusyId(null);
    }
  };

  const saveMerchantPolicy = async (patch: {
    optOut?: boolean;
    requireApproval?: boolean;
  }) => {
    const prevOptOut = merchantOptOut;
    const prevRequire = merchantRequireApproval;
    if (typeof patch.optOut === "boolean") setMerchantOptOut(patch.optOut);
    if (typeof patch.requireApproval === "boolean") {
      setMerchantRequireApproval(patch.requireApproval);
    }
    setMerchantSaving(true);
    try {
      await Parse.Cloud.run("setCalendarMerchantEventPolicy", {
        calendarId: targetId,
        ...patch,
      });
    } catch {
      setMerchantOptOut(prevOptOut);
      setMerchantRequireApproval(prevRequire);
    } finally {
      setMerchantSaving(false);
    }
  };

  function handleSlugChange(raw: string) {
    const cleaned = raw
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 40);
    setSlug(cleaned);
    setSlugAvailable(null);
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    if (cleaned === originalSlugRef.current) {
      setSlugAvailable(null);
      return;
    }
    if (cleaned.length < 3) {
      setSlugAvailable(false);
      return;
    }
    setSlugChecking(true);
    slugTimerRef.current = setTimeout(async () => {
      try {
        const result = (await Parse.Cloud.run("checkSlugAvailable", {
          slug: cleaned,
          excludeCalendarId: targetId,
        })) as { available: boolean };
        setSlugAvailable(result.available);
      } catch {
        setSlugAvailable(null);
      } finally {
        setSlugChecking(false);
      }
    }, 350);
  }

  async function handleSave() {
    if (!name || saving) return;
    if (slug !== originalSlugRef.current && (slugAvailable === false || slugChecking)) {
      return;
    }
    setSaving(true);
    try {
      const p: Record<string, string | number | boolean> = {
        calendarId: targetId,
        name,
        description,
        hideVenueUntilRsvp: hideVenue,
        requireApprovalDefault,
        allowFollowersToHost,
        isPrivate,
        hidePlanIdeas,
        hideCustomPlans,
        hideDeals,
      };
      if (slug !== originalSlugRef.current) p.slug = slug;
      if (citySelected && city) {
        p.city = city;
        if (lat != null && lng != null) {
          p.lat = lat;
          p.lng = lng;
        }
      }
      if (imageBase64) p.imageBase64 = imageBase64;
      else if (removeImage) p.removeImage = true;

      await Parse.Cloud.run("updateCalendar", p);
      router.push(`/dashboard/${orgId}?tab=calendars`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update calendar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMakePrimary() {
    if (!targetCalendar) return;
    if (
      !confirm(
        `Make "${targetCalendar.name}" your primary calendar? Billing, ownership, and org-level settings will move to this calendar. The dashboard URL will change — existing bookmarks may need updating.`
      )
    )
      return;
    try {
      const result = (await Parse.Cloud.run("makePrimaryCalendar", {
        calendarId: targetId,
        orgId,
      })) as { newOrgId?: string };
      const nextOrg = result?.newOrgId || orgId;
      router.push(`/dashboard/${nextOrg}?tab=calendars`);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to make calendar primary."
      );
    }
  }

  async function handleDelete() {
    if (!targetCalendar) return;
    if (
      !confirm(
        `Permanently delete "${targetCalendar.name}"? This will remove all its plans, followers, and data. This cannot be undone.`
      )
    )
      return;
    try {
      await Parse.Cloud.run("deleteCalendar", { calendarId: targetId, orgId });
      router.push(`/dashboard/${orgId}?tab=calendars`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete calendar.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-sm text-zinc-400">Loading…</div>
      </div>
    );
  }
  if (loadError || !targetCalendar || !dashboard) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <p className="text-sm text-zinc-700">
            {loadError || "Calendar not found."}
          </p>
          <Link
            href={`/dashboard/${orgId}?tab=calendars`}
            className="inline-block mt-4 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const saveDisabled =
    !name ||
    saving ||
    (slug !== originalSlugRef.current && (slugAvailable === false || slugChecking));

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <Link
            href={`/dashboard/${orgId}?tab=calendars`}
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft className="w-3 h-3" /> Back to dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-light tracking-tight">
            Edit calendar
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            {targetCalendar.name}
            {isPrimary && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-semibold uppercase tracking-widest">
                Primary
              </span>
            )}
          </p>
        </div>

        {/* ─── Identity ────────────────────────────────────────────── */}
        <Section title="Profile">
          <div className="flex items-center gap-4">
            <div className="relative group">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="Calendar"
                  className="w-16 h-16 rounded-xl object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-zinc-100 flex items-center justify-center">
                  <ImagePlus className="w-6 h-6 text-zinc-300" />
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <ImagePlus className="w-5 h-5 text-white" />
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      alert("Image must be under 5MB");
                      return;
                    }
                    try {
                      const { preview, base64 } = await processImageFile(file);
                      setImagePreview(preview);
                      setImageBase64(base64);
                      setRemoveImage(false);
                    } catch {
                      alert("Could not process this image. Please try a different file.");
                    }
                  }}
                />
              </label>
            </div>
            <div className="flex-1">
              <p className="text-xs text-zinc-500">Calendar image</p>
              <p className="text-xs text-zinc-400">
                Overrides org logo on public page
              </p>
              {imagePreview && (
                <button
                  onClick={() => {
                    setImagePreview(null);
                    setImageBase64(null);
                    setRemoveImage(true);
                  }}
                  className="text-xs text-red-500 hover:text-red-700 mt-1"
                >
                  Remove image
                </button>
              )}
            </div>
          </div>

          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border-b border-zinc-300 py-2 text-lg font-light focus:outline-none focus:border-zinc-900"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-zinc-200 rounded-lg p-3 text-sm font-light focus:outline-none focus:border-zinc-400 resize-y"
              placeholder="What is this calendar about?"
            />
          </Field>
          <Field label="URL slug">
            <div className="flex items-center gap-0">
              <span className="text-sm text-zinc-400 font-light whitespace-nowrap">
                os.joinleaf.com/org/
              </span>
              <input
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                className="flex-1 border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900 ml-1"
                placeholder="my-calendar"
              />
            </div>
            {slug && slug !== originalSlugRef.current && (
              <p
                className={`text-xs mt-1 ${
                  slugChecking
                    ? "text-zinc-400"
                    : slugAvailable === true
                      ? "text-green-600"
                      : slugAvailable === false
                        ? "text-red-500"
                        : "text-zinc-400"
                }`}
              >
                {slugChecking
                  ? "Checking..."
                  : slugAvailable === true
                    ? "Available!"
                    : slugAvailable === false
                      ? slug.length < 3
                        ? "Must be at least 3 characters"
                        : "Already taken"
                      : ""}
              </p>
            )}
          </Field>
          {dashboard.tier === "pro" && (
            <Field label="Location">
              <CityAutocomplete
                value={city}
                onChange={(v) => {
                  setCity(v);
                  setCitySelected(false);
                  setLat(null);
                  setLng(null);
                }}
                onSelect={(place) => {
                  setCity(place.description);
                  setCitySelected(true);
                  if (place.lat != null && place.lng != null) {
                    setLat(place.lat);
                    setLng(place.lng);
                  }
                }}
                placeholder="City, neighborhood, or building address"
                className="w-full border-b border-zinc-300 py-2 text-lg font-light focus:outline-none focus:border-zinc-900"
              />
            </Field>
          )}
        </Section>

        {/* ─── Local business events ──────────────────────────────── */}
        {canManageMerchant && (
          <Section title="Local business events">
            <div className="flex items-center justify-between py-2 gap-4">
              <div>
                <p className="text-xs font-medium text-zinc-700">
                  Allow local business events
                </p>
                <p className="text-xs text-zinc-400 max-w-md">
                  Let nearby businesses pay to host events on this calendar —
                  tastings, classes, happy hours. Followers RSVP; you never get
                  charged. We suppress SMS for these, so they only reach the
                  app and email.
                </p>
              </div>
              <SettingsSwitch
                checked={!merchantOptOut}
                disabled={merchantSaving}
                onChange={(allow) => saveMerchantPolicy({ optOut: !allow })}
                label="Allow local business events"
              />
            </div>
            {!merchantOptOut && (
              <div className="flex items-center justify-between py-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-zinc-700">
                    Review each event first
                  </p>
                  <p className="text-xs text-zinc-400 max-w-md">
                    When on, a business event won&apos;t go live on this
                    calendar until you approve it. When off, approved events
                    publish automatically.
                  </p>
                </div>
                <SettingsSwitch
                  checked={merchantRequireApproval}
                  disabled={merchantSaving}
                  onChange={(v) => saveMerchantPolicy({ requireApproval: v })}
                  label="Require approval"
                />
              </div>
            )}

            {approvals.length > 0 && (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Business event requests
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Approve to publish to this calendar, or decline.
                </p>
                <ul className="mt-3 space-y-2">
                  {approvals.map((a) => (
                    <li
                      key={a.objectId}
                      className="flex items-center justify-between gap-3 bg-white border border-zinc-200 rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {a.eventTitle}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {a.businessName || "A local business"}
                          {a.eventDate
                            ? ` · ${new Date(a.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                            : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={approvalBusyId === a.objectId}
                          onClick={() => decideApproval(a.objectId, false)}
                          className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          disabled={approvalBusyId === a.objectId}
                          onClick={() => decideApproval(a.objectId, true)}
                          className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3 py-1.5 rounded-lg"
                        >
                          Approve
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        )}

        {/* ─── Privacy & access ──────────────────────────────────── */}
        <Section title="Privacy & access">
          <ToggleRow
            title="Hide venue until RSVP"
            hint="Show only neighborhood on public page"
            checked={hideVenue}
            onChange={setHideVenue}
          />
          <ToggleRow
            title="Require approval to attend by default"
            hint="New plans require host approval before RSVPs are confirmed"
            checked={requireApprovalDefault}
            onChange={setRequireApprovalDefault}
          />
          <ToggleRow
            title="Let followers host suggested plans"
            hint="When on, any follower can turn a Suggestion into a real plan and be listed as the host. Off by default — only you and co-hosts can."
            checked={allowFollowersToHost}
            onChange={setAllowFollowersToHost}
          />
          <ToggleRow
            title="Private calendar"
            hint="Visitors must request to follow before seeing plans"
            checked={isPrivate}
            onChange={setIsPrivate}
          />
        </Section>

        {/* ─── Concierge ─────────────────────────────────────────── */}
        {isConciergeOrg && (
          <Section title="Concierge">
            {isServicedHere ? (
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  Your concierge runs this calendar
                </h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-md">
                  Your dedicated concierge plans and arranges events for this
                  calendar. To move it, add concierge to a different calendar.
                </p>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Add concierge to this calendar
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1 max-w-md">
                    Move your dedicated concierge here. They&apos;ll plan and
                    arrange events for this calendar going forward.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmConcierge(true)}
                  className="shrink-0 text-xs font-bold uppercase tracking-widest text-zinc-700 hover:text-zinc-900 transition-colors"
                >
                  Add Concierge
                </button>
              </div>
            )}
          </Section>
        )}

        {/* ─── Advanced ──────────────────────────────────────────── */}
        <Section title="Advanced" defaultOpen={false}>
          <ToggleRow
            title="Show suggested plans"
            hint="Let members browse and host AI-suggested plans"
            checked={!hidePlanIdeas}
            onChange={(v) => setHidePlanIdeas(!v)}
          />
          {!hidePlanIdeas && (
            <Link
              href={`/dashboard/${orgId}?tab=settings`}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors underline block -mt-1 mb-1"
            >
              Automated suggestion settings
            </Link>
          )}
          <ToggleRow
            title="Hide custom plan proposals"
            hint="Prevent members from proposing their own plans"
            checked={hideCustomPlans}
            onChange={setHideCustomPlans}
          />
          <ToggleRow
            title="Show local deals"
            hint="Surface a strip of deals from nearby businesses"
            checked={!hideDeals}
            onChange={(v) => setHideDeals(!v)}
          />
        </Section>

        <button
          onClick={handleSave}
          disabled={saveDisabled}
          className="w-full bg-zinc-900 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50 mt-6"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>

        {/* ─── Danger zone ───────────────────────────────────────── */}
        {(canMakePrimary || canDelete) && (
          <div className="mt-10 border-t border-zinc-100 pt-6">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
              Danger zone
            </p>
            {canMakePrimary && (
              <button
                onClick={handleMakePrimary}
                className="w-full text-center py-2 mb-2 text-xs font-bold uppercase tracking-widest text-zinc-700 hover:text-zinc-900 transition-colors"
              >
                Make primary
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                className="w-full text-center py-2 text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
              >
                Delete calendar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Move-concierge confirmation */}
      {confirmConcierge && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !settingConcierge && setConfirmConcierge(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-zinc-900 mb-2">
              Move your concierge here?
            </h3>
            <p className="text-sm text-zinc-600 leading-relaxed">
              You&apos;re moving your concierge to{" "}
              <span className="font-medium text-zinc-900">{targetCalendar.name}</span>.
              Your dedicated concierge will now plan and arrange events for this
              calendar
              {currentServicedName ? ` and stop running ${currentServicedName}` : ""}.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setConfirmConcierge(false)}
                disabled={settingConcierge}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddConcierge}
                disabled={settingConcierge}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-60"
              >
                {settingConcierge ? "Moving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-8 border-t border-zinc-100 pt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2 group"
      >
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 group-hover:text-zinc-700 transition-colors">
          {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="pt-3 space-y-4">{children}</div>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function ToggleRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-zinc-700">{title}</p>
        <p className="text-xs text-zinc-400">{hint}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`shrink-0 relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-zinc-900" : "bg-zinc-200"}`}
        aria-label={title}
        role="switch"
        aria-checked={checked}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "left-5" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}
