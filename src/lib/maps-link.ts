/**
 * A maps link for a venue a viewer is allowed to see. Null without a street
 * address: a bare name ("Home", "My place") searches for nothing useful, so
 * those stay plain text.
 */
export function mapsSearchHref(name: string | null | undefined, address: string | null | undefined): string | null {
  const addr = (address || "").trim();
  if (!addr) return null;
  const query = [(name || "").trim(), addr].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
