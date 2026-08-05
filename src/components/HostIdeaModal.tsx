"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Parse from "@/lib/parse-client";
import { isVenueBlacklisted } from "@/lib/venue-blacklist";
import { ensureGooglePlaces, fetchVenuePhotoUrl } from "@/lib/google-places";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Loader2,
  MapPin,
  Pencil,
  Repeat,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";

export interface HostIdeaModalIdea {
  objectId: string;
  title: string;
  image?: string | null;
  category?: string | null;
  centroid?: string | null;
  suggestedCapacity?: number | null;
  // Venue the owner picked when the suggestion was created. Pre-selected below
  // so hosting keeps it instead of silently swapping in a Places result.
  location?: {
    name: string;
    address: string;
    placeId?: string | null;
    photoUrl?: string | null;
    rating?: number | null;
  } | null;
  ideaSeriesId?: string | null;
  // Optional owner-chosen start time ("HH:mm") — prefills the time picker.
  preferredTime?: string | null;
}

interface NearbyVenue {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  photoUrl: string | null;
  flagged?: boolean;
}

// Stand-in placeId for a suggestion venue that was saved without a Google
// place id (owner-typed venues). Never sent to the server — a selection still
// on the suggested venue submits no `venue` at all, so the server keeps the
// suggestion's own location object (and its resolved timezone).
const SUGGESTED_VENUE_ID = "__suggested__";

/**
 * Host-a-suggestion modal — the SAME experience the public /org/[shareId] page
 * uses (venue carousel + free-text venue search over Google Places, date/time,
 * note, require-approval), extracted so the owner dashboard opens an identical
 * modal when a suggested-plan card is tapped.
 *
 * Owner/co-host callers (the dashboard's Calendars tab is already gated to
 * those roles) publish live via hostPlanIdea's owner/co-host branch — no
 * phone verification or pending-approval friction. Callers where the viewer
 * might NOT be owner/co-host (e.g. /me's "on calendars you follow" section)
 * should pass `hostName`/`hostPhone`; hostPlanIdea uses them for its
 * pending-host-request branch and ignores them otherwise.
 * Owner tools (edit the suggestion, assign a host, delete) are surfaced as an
 * optional actions row when the matching callbacks are provided.
 */
export default function HostIdeaModal({
  idea,
  prefillDate = null,
  orgCity = null,
  orgAddress = null,
  tier = "starter",
  brandColor = null,
  requireApprovalDefault = false,
  blacklistCategories = [],
  excludeKeywords = [],
  hostName = null,
  hostPhone = null,
  onClose,
  onHosted,
  onEditSuggestion,
  onAssignHost,
  onDelete,
  onEndSeries,
}: {
  idea: HostIdeaModalIdea;
  prefillDate?: Date | null;
  orgCity?: string | null;
  orgAddress?: string | null;
  tier?: string;
  brandColor?: string | null;
  requireApprovalDefault?: boolean;
  blacklistCategories?: string[];
  excludeKeywords?: string[];
  // Non-owner/co-host callers (e.g. a follower proposing to host someone
  // else's calendar) need these — hostPlanIdea requires them for its
  // pending-request branch and ignores them on the owner/co-host branch.
  hostName?: string | null;
  hostPhone?: string | null;
  onClose: () => void;
  onHosted: (result: { pendingApproval?: boolean; eventGroupId?: string } | undefined) => void;
  onEditSuggestion?: () => void;
  // Assign-a-host picker — also where the AI-assisted host lives (it's one of
  // the hosts you can hand the plan to, not a parallel action).
  onAssignHost?: () => void;
  onDelete?: () => void;
  onEndSeries?: () => void;
}) {
  // The venue already on the suggestion (owner picked it at creation time).
  // It leads the carousel and starts selected, so hosting keeps it unless the
  // hoster deliberately picks something else.
  // Saved venues carry no photo (the venue autocomplete doesn't capture one),
  // so we look one up from Places and fold it in below.
  const [suggestedPhotoUrl, setSuggestedPhotoUrl] = useState<string | null>(null);

  const suggestedVenue = useMemo<NearbyVenue | null>(() => {
    if (!idea.location?.name) return null;
    return {
      placeId: idea.location.placeId || SUGGESTED_VENUE_ID,
      name: idea.location.name,
      address: idea.location.address || "",
      rating: idea.location.rating ?? null,
      photoUrl: idea.location.photoUrl ?? suggestedPhotoUrl,
    };
  }, [idea.location, suggestedPhotoUrl]);

  const [venueSearchQuery, setVenueSearchQuery] = useState("");
  const [nearbyVenues, setNearbyVenues] = useState<NearbyVenue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<NearbyVenue | null>(suggestedVenue);
  const [hostNote, setHostNote] = useState("");
  const [hostRequireApproval, setHostRequireApproval] = useState(requireApprovalDefault);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);

  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  // Delete lives on its own at the bottom of the panel (below Host plan), so
  // the top action row only carries the non-destructive owner tools.
  const hasTopActions = !!(onEditSuggestion || onAssignHost || onEndSeries);

  // Pull a cover photo for the suggestion's own venue — by place id when we
  // have one, otherwise by name+address. Keyed on primitives so callers that
  // rebuild `idea` each render don't re-fire this.
  const ideaVenueName = idea.location?.name || "";
  const ideaVenueAddress = idea.location?.address || "";
  const ideaVenuePlaceId = idea.location?.placeId || "";
  const ideaVenuePhoto = idea.location?.photoUrl || "";
  useEffect(() => {
    if (!ideaVenueName || ideaVenuePhoto) return;
    let cancelled = false;
    fetchVenuePhotoUrl({ name: ideaVenueName, address: ideaVenueAddress, placeId: ideaVenuePlaceId })
      .then((url) => { if (url && !cancelled) setSuggestedPhotoUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [ideaVenueName, ideaVenueAddress, ideaVenuePlaceId, ideaVenuePhoto]);

  // Fetch nearby venues via Google Places whenever the modal opens or the
  // free-text venue query changes. Mirrors the public /org host modal: a typed
  // query overrides the idea's AI category so any specific venue is findable.
  useEffect(() => {
    // Prefer the calendar's precise address (concierge intake) so results are
    // centered on the actual location, not a whole city; fall back to the
    // idea's centroid, then the org city.
    const searchCenter = orgAddress || idea.centroid || orgCity || "";
    const typedVenueQuery = venueSearchQuery.trim();
    const searchCategory = typedVenueQuery || idea.category || "";

    // The suggestion already has a venue — that's the answer, so don't sweep
    // Places for alternatives nobody asked for. Typing in the search box opts
    // back into results.
    if (suggestedVenue && !typedVenueQuery) {
      setNearbyVenues([]);
      setSelectedVenue(suggestedVenue);
      setVenuesLoading(false);
      return;
    }

    if (!searchCategory) {
      setNearbyVenues([]);
      setVenuesLoading(false);
      return;
    }

    setNearbyVenues([]);
    // A typed search means the hoster is shopping for a different venue, so
    // drop the current pick; the default category sweep must NOT clear the
    // suggestion's own venue out from under them.
    setSelectedVenue(typedVenueQuery ? null : suggestedVenue);
    setVenuesLoading(true);

    // The idea's default category search is instant; typed queries debounce.
    const debounceMs = typedVenueQuery ? 400 : 0;
    const timer = setTimeout(() => {
      const doSearch = async () => {
        try {
          if (!(await ensureGooglePlaces())) { setVenuesLoading(false); return; }

          const service = new window.google.maps.places.PlacesService(document.createElement("div"));
          const toVenue = (place: google.maps.places.PlaceResult): NearbyVenue => ({
            placeId: place.place_id || "",
            name: place.name || "",
            // nearbySearch returns `vicinity`; textSearch returns `formatted_address`.
            address: place.formatted_address || place.vicinity || "",
            rating: place.rating || null,
            photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 400 }) || null,
            flagged: isVenueBlacklisted(place.name || "", place.types || [], blacklistCategories, excludeKeywords),
          });
          const publish = (results: google.maps.places.PlaceResult[] | null) => {
            setNearbyVenues((results || []).slice(0, 8).map(toVenue));
            setVenuesLoading(false);
          };
          // Prominence-ranked fallback within a bounded area (used when we have
          // no geocoded center, or the distance search comes back empty).
          const textFallback = (center?: google.maps.LatLng) => {
            const req: google.maps.places.TextSearchRequest = center
              ? { query: searchCategory, location: center, radius: 25000 }
              : { query: `${searchCategory}${searchCenter ? ` in ${searchCenter}` : ""}` };
            service.textSearch(req, (results, status) => {
              publish(status === window.google.maps.places.PlacesServiceStatus.OK ? results : []);
            });
          };

          // Geocode the calendar's location → distance-ranked nearby search so
          // the CLOSEST matching venues come first (textSearch ranks by
          // prominence, which surfaced far-but-famous venues before).
          let center: google.maps.LatLng | null = null;
          if (searchCenter) {
            try {
              const geocoder = new window.google.maps.Geocoder();
              const geoResult = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
                geocoder.geocode({ address: searchCenter }, (results, status) => {
                  if (status === window.google.maps.GeocoderStatus.OK && results?.length) resolve(results);
                  else reject(new Error("Geocode failed"));
                });
              });
              center = geoResult[0].geometry.location;
            } catch {
              center = null;
            }
          }

          if (center) {
            service.nearbySearch(
              { location: center, rankBy: window.google.maps.places.RankBy.DISTANCE, keyword: searchCategory },
              (results, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.length) {
                  publish(results);
                } else {
                  // No distance-ranked hits — fall back to prominence near the center.
                  textFallback(center || undefined);
                }
              },
            );
          } else {
            textFallback();
          }
        } catch {
          setVenuesLoading(false);
        }
      };
      doSearch();
    }, debounceMs);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idea.objectId, idea.category, idea.centroid, venueSearchQuery, orgCity, orgAddress]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dateVal = dateRef.current?.value;
    if (!dateVal) {
      setError("Pick a date for the plan.");
      return;
    }
    setSubmitting(true);
    setError(null);

    // Submitter-local ISO datetime with an explicit offset so the server
    // anchors the wall-clock in the caller's zone.
    const timeVal = timeRef.current?.value || "18:00";
    const offset = new Date().getTimezoneOffset();
    const sign = offset <= 0 ? "+" : "-";
    const absH = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
    const absM = String(Math.abs(offset) % 60).padStart(2, "0");
    const dateTime = `${dateVal}T${timeVal}${sign}${absH}:${absM}`;

    try {
      const result = await Parse.Cloud.run("hostPlanIdea", {
        calendarPlanId: idea.objectId,
        date: dateTime,
        capacity: idea.suggestedCapacity || 20,
        hostNote: hostNote.trim() || undefined,
        requireApproval: hostRequireApproval,
        hostName: hostName || undefined,
        hostPhone: hostPhone || undefined,
        // Sending no venue tells the server to keep the suggestion's own
        // location — the right move when the pick is still the suggested one.
        venue: selectedVenue && selectedVenue.placeId !== suggestedVenue?.placeId
          ? {
              placeId: selectedVenue.placeId,
              name: selectedVenue.name,
              address: selectedVenue.address,
              photoUrl: selectedVenue.photoUrl,
              rating: selectedVenue.rating,
            }
          : undefined,
      });
      setSuccess(true);
      // Refresh the parent behind the success screen, then auto-close.
      onHosted(result as { pendingApproval?: boolean; eventGroupId?: string } | undefined);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      console.error("Failed to host suggestion:", err);
      setError(err instanceof Error ? err.message : "Failed to host this plan.");
      setSubmitting(false);
    }
  }

  // The suggestion's own venue leads the carousel; Places results follow with
  // any duplicate of it dropped (matched on place id, then on name).
  const displayVenues = suggestedVenue
    ? [
        suggestedVenue,
        ...nearbyVenues.filter(
          (v) =>
            v.placeId !== suggestedVenue.placeId &&
            v.name.trim().toLowerCase() !== suggestedVenue.name.trim().toLowerCase(),
        ),
      ]
    : nearbyVenues;

  const defaultDateStr = prefillDate ? prefillDate.toISOString().split("T")[0] : "";
  const todayStr = new Date().toISOString().split("T")[0];
  const maxDateStr = tier === "starter"
    ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl max-h-[92vh] md:h-[85vh] md:max-h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-t-3xl md:rounded-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-50 p-2 rounded-full bg-white/70 text-zinc-900 md:bg-transparent hover:bg-white transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Cover */}
        <div className="hidden md:block w-1/2 h-full bg-zinc-100">
          {idea.image && !coverFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={idea.image} className="w-full h-full object-cover" alt="" onError={() => setCoverFailed(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Sparkles className="w-20 h-20 text-zinc-300" />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-6 md:p-12 space-y-7">
          {success ? (
            <div className="py-20 text-center space-y-6">
              <div className="w-20 h-20 border border-zinc-900 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-2xl font-light">Your plan is scheduled.</h4>
              <p className="text-zinc-400 uppercase tracking-widest text-xs">Closing…</p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-[11px] tracking-widest uppercase text-zinc-400 font-bold mb-1">Host this plan</p>
                <h3 className="text-2xl md:text-3xl font-light">{idea.title}</h3>
              </div>

              {/* Owner tools — edit the suggestion / assign. Delete is moved
                  to its own row at the bottom of the panel. */}
              {hasTopActions && (
                <div className="flex flex-wrap items-center gap-2">
                  {onEditSuggestion && (
                    <button
                      type="button"
                      onClick={onEditSuggestion}
                      className="inline-flex items-center gap-1.5 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-400 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit suggestion
                    </button>
                  )}
                  {onAssignHost && (
                    <button
                      type="button"
                      onClick={onAssignHost}
                      className="inline-flex items-center gap-1.5 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-400 transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Assign a host
                    </button>
                  )}
                  {onEndSeries && idea.ideaSeriesId && (
                    <button
                      type="button"
                      onClick={onEndSeries}
                      className="inline-flex items-center gap-1.5 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-400 transition-colors"
                    >
                      <Repeat className="w-3.5 h-3.5" /> End series
                    </button>
                  )}
                </div>
              )}

              {/* Venue carousel */}
              <div className="space-y-3">
                <h4 className="text-xs tracking-wider uppercase font-bold text-zinc-400">Choose a venue</h4>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    name="venue-search"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore
                    value={venueSearchQuery}
                    onChange={(e) => setVenueSearchQuery(e.target.value)}
                    placeholder="Search for a different venue…"
                    className="w-full border border-zinc-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-zinc-900 transition-colors"
                  />
                </div>
                {displayVenues.length > 0 || venuesLoading ? (
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    {displayVenues.map((venue) => {
                      const isSuggested = !!suggestedVenue && venue.placeId === suggestedVenue.placeId;
                      return (
                        <button
                          key={venue.placeId}
                          type="button"
                          onClick={() => setSelectedVenue(selectedVenue?.placeId === venue.placeId ? null : venue)}
                          className={`min-w-[160px] max-w-[160px] shrink-0 rounded-xl overflow-hidden border-2 transition-all text-left relative ${
                            selectedVenue?.placeId === venue.placeId
                              ? "border-zinc-900 shadow-lg"
                              : venue.flagged
                                ? "border-amber-300 hover:border-amber-400"
                                : "border-zinc-200 hover:border-zinc-300"
                          }`}
                        >
                          {venue.flagged && (
                            <div className="absolute top-1.5 right-1.5 bg-amber-500 text-white rounded-full p-0.5 z-10">
                              <AlertTriangle className="w-3 h-3" />
                            </div>
                          )}
                          <div className="h-[100px] bg-zinc-100">
                            {venue.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={venue.photoUrl} className="w-full h-full object-cover" alt={venue.name} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <MapPin className="w-6 h-6 text-zinc-300" />
                              </div>
                            )}
                          </div>
                          <div className="p-2.5">
                            {isSuggested && (
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Chosen venue</p>
                            )}
                            <p className="text-xs font-bold truncate">{venue.name}</p>
                            {venue.rating && (
                              <span className="text-xs text-zinc-500">{venue.rating.toFixed(1)} &#9733;</span>
                            )}
                            <p className="text-xs text-zinc-400 truncate mt-0.5">{venue.address}</p>
                          </div>
                        </button>
                      );
                    })}
                    {venuesLoading && [0, 1, 2, 3, 4].map((i) => (
                      <div key={`venue-skeleton-${i}`} className="min-w-[160px] h-[180px] bg-zinc-100 rounded-xl animate-pulse shrink-0" />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400 italic">No venues found nearby — search above.</p>
                )}
                {selectedVenue && (
                  <p className="text-xs text-zinc-600 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {selectedVenue.name} &mdash; {selectedVenue.address}
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs tracking-wider uppercase font-bold">Date</label>
                    <input
                      ref={dateRef}
                      type="date"
                      required
                      min={todayStr}
                      max={maxDateStr}
                      defaultValue={defaultDateStr}
                      className="w-full border-b border-zinc-300 py-2.5 text-lg font-light focus:outline-none focus:border-zinc-900 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs tracking-wider uppercase font-bold">Start time</label>
                    <input
                      ref={timeRef}
                      type="time"
                      required
                      defaultValue={idea.preferredTime || "18:00"}
                      className="w-full border-b border-zinc-300 py-2.5 text-lg font-light focus:outline-none focus:border-zinc-900 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs tracking-wider uppercase font-bold">Host&apos;s note</label>
                  <textarea
                    value={hostNote}
                    onChange={(e) => setHostNote(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="w-full border border-zinc-200 rounded-lg p-4 text-sm font-light focus:outline-none focus:border-zinc-900 transition-colors resize-none"
                    placeholder="Add a personal note for attendees (optional)"
                  />
                  <p className="text-xs text-zinc-400 text-right">{hostNote.length}/500</p>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-xs tracking-wider uppercase font-bold">Require approval to attend</p>
                    <p className="text-xs text-zinc-400 font-light">Visitors must be approved before confirming</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHostRequireApproval(!hostRequireApproval)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${hostRequireApproval ? "bg-zinc-900" : "bg-zinc-200"}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hostRequireApproval ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="pt-2 flex gap-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 text-xs uppercase tracking-widest font-medium text-zinc-500 hover:text-zinc-900 py-3"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 text-white py-3.5 text-xs uppercase tracking-wider font-bold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ backgroundColor: brandColor || "#18181b" }}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                    {submitting ? "Publishing…" : "Host plan"}
                  </button>
                </div>

                {/* Destructive action, separated at the very bottom so it's
                    well clear of Host plan. */}
                {onDelete && (
                  <div className="pt-4 mt-2 border-t border-zinc-100 flex justify-center">
                    <button
                      type="button"
                      onClick={onDelete}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 transition-colors py-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete this plan suggestion
                    </button>
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
