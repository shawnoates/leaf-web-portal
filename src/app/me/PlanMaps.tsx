"use client";

import { useEffect, useRef, useState } from "react";
import { ensureGooglePlaces } from "@/lib/google-places";

// ============================================================================
// The /me maps, restored from the original handoff design: a pin map of the
// week in the desktop rail, and a single-venue mini map in the plan modal.
// Both ride the Maps JS API already loaded for venue autocomplete — no new
// API product, no second <script>. Every component renders nothing (and takes
// no space) until the map is actually up, so a missing key degrades silently.
//
// Coordinates come from getMeDashboard and are server-redacted under the same
// rule as the venue name/address ("hide venue until RSVP"), so a plan with a
// gated venue simply has no pin.
// ============================================================================

// Keep the base map quiet so the pins read: no POI icons, no transit clutter.
const CALM: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

/** Single-venue, non-interactive map. Tapping it opens `href` (directions). */
export function PlanMiniMap({
  lat, lng, title, href,
}: {
  lat: number;
  lng: number;
  title: string;
  href: string | null;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  // The container keeps its height through "loading" (Maps JS can't lay out
  // in a collapsed box) and disappears entirely only when the API is off.
  const [status, setStatus] = useState<"loading" | "up" | "off">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await ensureGooglePlaces();
      if (cancelled || !boxRef.current) return;
      if (!ok) { setStatus("off"); return; }
      const map = new google.maps.Map(boxRef.current, {
        center: { lat, lng },
        zoom: 15,
        disableDefaultUI: true,
        gestureHandling: "none",
        clickableIcons: false,
        keyboardShortcuts: false,
        styles: CALM,
      });
      new google.maps.Marker({ map, position: { lat, lng }, title });
      setStatus("up");
    })();
    return () => { cancelled = true; };
  }, [lat, lng, title]);

  if (status === "off") return null;
  return (
    <div
      className={`lm-map mini ${status === "up" ? "up" : ""}`}
      role={href ? "link" : undefined}
      aria-label={href ? `Map of ${title} — open directions` : undefined}
      tabIndex={href && status === "up" ? 0 : -1}
      onClick={() => { if (href) window.open(href, "_blank", "noopener"); }}
      onKeyDown={(e) => {
        if (href && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          window.open(href, "_blank", "noopener");
        }
      }}
    >
      <div ref={boxRef} className="lm-map-canvas" />
    </div>
  );
}

export interface MapPin { id: string; lat: number; lng: number; title: string }

/** The week's plans as pins. Clicking a pin opens that plan's modal. */
export function PlansRailMap({
  pins, onOpen,
}: {
  pins: MapPin[];
  onOpen: (planId: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "up" | "off">("loading");
  // The click handler closes over live state; keep the latest without
  // rebuilding the map (and re-fitting bounds) on every parent render.
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const pinsKey = JSON.stringify(pins.map((p) => [p.id, p.lat, p.lng]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pins.length) return;
      const ok = await ensureGooglePlaces();
      if (cancelled || !boxRef.current) return;
      if (!ok) { setStatus("off"); return; }
      const map = new google.maps.Map(boxRef.current, {
        disableDefaultUI: true,
        gestureHandling: "cooperative",
        clickableIcons: false,
        styles: CALM,
      });
      const bounds = new google.maps.LatLngBounds();
      for (const p of pins) {
        const marker = new google.maps.Marker({
          map,
          position: { lat: p.lat, lng: p.lng },
          title: p.title,
        });
        marker.addListener("click", () => onOpenRef.current(p.id));
        bounds.extend({ lat: p.lat, lng: p.lng });
      }
      map.fitBounds(bounds, 36);
      // One venue (or several at the same spot) fits to max zoom — pull back.
      google.maps.event.addListenerOnce(map, "idle", () => {
        const z = map.getZoom();
        if (typeof z === "number" && z > 14) map.setZoom(14);
      });
      setStatus("up");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey]);

  if (!pins.length || status === "off") return null;
  return (
    <div className={`lm-map rail ${status === "up" ? "up" : ""}`}>
      <div ref={boxRef} className="lm-map-canvas" />
    </div>
  );
}
