// Where a photo sits behind the host share card (/api/og/plan-share and the
// share kit's in-browser compositing — one rule, so a camera-roll photo and a
// gallery photo land the same way).
//
// A photo close to the card's shape fills it, cropped from the centre. A WIDE
// one doesn't: cover-cropping a landscape shot into a 9:16 story keeps the
// middle third and cuts off whoever stood at the edges. Past the point where
// the crop would lose more than 30% of the width, the whole photo is shown
// instead, full width, centred in the space above the type, over a blurred
// copy of itself that fills the card.

export type Box = { x: number; y: number; width: number; height: number };

/** Least share of the photo's width a cover crop may keep before we fit instead. */
const MIN_KEPT = 0.7;

/** Height the type takes at the bottom of the card; the photo centres above it. */
const TYPE_BAND = { story: 520, other: 400 } as const;

/** The blurred copy of the photo that fills the card behind a fitted one. */
export const BLUR_PX = 48;
/** How far that copy overscans the card, so the blur's faded edge is cropped. */
export const BLUR_BLEED = 96;
/** Laid over the blur so the sharp photo reads as the subject. */
export const BLUR_TINT = "rgba(15,31,26,0.35)";

export function photoPlacement(
  photo: { width: number; height: number },
  card: { width: number; height: number },
): Box & { fitted: boolean } {
  const cardAspect = card.width / card.height;
  const photoAspect = photo.width / photo.height;
  if (!Number.isFinite(photoAspect) || photoAspect <= 0 || cardAspect / photoAspect >= MIN_KEPT) {
    const scale = Math.max(card.width / photo.width, card.height / photo.height) || 1;
    const width = photo.width * scale;
    const height = photo.height * scale;
    return { x: (card.width - width) / 2, y: (card.height - height) / 2, width, height, fitted: false };
  }
  const height = Math.round(card.width / photoAspect);
  const band = card.height - (cardAspect < 0.7 ? TYPE_BAND.story : TYPE_BAND.other);
  return {
    x: 0,
    y: Math.max(0, Math.round((band - height) / 2)),
    width: card.width,
    height,
    fitted: true,
  };
}

// Pixel size from the file's own header: JPEG (SOF marker), PNG (IHDR), WebP
// (VP8/VP8L/VP8X). No decode and no dependency. EXIF rotation is NOT applied,
// on purpose: Satori draws the pixels as stored, and the placement has to
// match what it draws. Null for anything unrecognised — the caller covers.
export function imageSize(buf: ArrayBuffer): { width: number; height: number } | null {
  const b = new Uint8Array(buf);
  const v = new DataView(buf);
  try {
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
      return { width: v.getUint32(16), height: v.getUint32(20) };
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i += 1; continue; }
        const marker = b[i + 1];
        if (marker === 0xff) { i += 1; continue; }
        // SOF0–SOF15, minus DHT (C4), JPG (C8) and DAC (CC).
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { width: v.getUint16(i + 7), height: v.getUint16(i + 5) };
        }
        // Markers with no length.
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
        i += 2 + v.getUint16(i + 2);
      }
      return null;
    }
    const tag = (o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
    if (tag(0) === "RIFF" && tag(8) === "WEBP") {
      const kind = tag(12);
      if (kind === "VP8X") {
        return {
          width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
          height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
        };
      }
      if (kind === "VP8 ") {
        return { width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff };
      }
      if (kind === "VP8L") {
        const bits = v.getUint32(21, true);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
    }
  } catch {
    // A truncated header: treat as unknown.
  }
  return null;
}
