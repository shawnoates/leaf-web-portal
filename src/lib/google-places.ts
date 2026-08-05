/**
 * Loads the Google Maps Places library on demand (shared by every venue
 * picker). Resolves false when no API key is configured, so callers can bail
 * quietly instead of throwing.
 */
export async function ensureGooglePlaces(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.google?.maps?.places) return true;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return false;
  if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
    await new Promise<void>((resolve) => {
      (window as unknown as Record<string, unknown>).__venueSearchCallback = () => resolve();
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__venueSearchCallback`;
      script.async = true;
      document.head.appendChild(script);
    });
  } else {
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (window.google?.maps?.places) { clearInterval(check); resolve(); }
      }, 100);
    });
  }
  return !!window.google?.maps?.places;
}

/**
 * Best-effort cover photo for a saved venue. Saved venues store no photo (the
 * autocomplete never captured one), so look it up by place id when we have
 * one and by name + address otherwise. Resolves null on any miss.
 */
export async function fetchVenuePhotoUrl(
  venue: { name: string; address?: string | null; placeId?: string | null },
  maxWidth = 400,
): Promise<string | null> {
  if (!venue.name || !(await ensureGooglePlaces())) return null;
  const service = new window.google.maps.places.PlacesService(document.createElement("div"));
  const ok = window.google.maps.places.PlacesServiceStatus.OK;
  const photoOf = (place: google.maps.places.PlaceResult | null) =>
    place?.photos?.[0]?.getUrl({ maxWidth }) || null;

  return new Promise((resolve) => {
    if (venue.placeId) {
      service.getDetails({ placeId: venue.placeId, fields: ["photos"] }, (place, status) => {
        resolve(status === ok ? photoOf(place) : null);
      });
    } else {
      service.textSearch({ query: `${venue.name} ${venue.address || ""}`.trim() }, (results, status) => {
        resolve(status === ok && results?.length ? photoOf(results[0]) : null);
      });
    }
  });
}
