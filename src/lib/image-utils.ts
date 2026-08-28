/** Longest edge we keep. The link-preview card is 1200x630, so this is ample. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;
/** Below this, re-encoding a small image usually makes it bigger — leave it alone. */
const SIZE_FLOOR = 400 * 1024;

/**
 * Shrink an oversized photo to MAX_EDGE and re-encode as JPEG.
 *
 * Straight-from-phone photos are multi-megabyte, and link unfurlers (iMessage,
 * Twitter) silently drop an og:image that large — so an uploaded calendar photo
 * would render as a blank preview card. Returns the original blob untouched if
 * it is already small enough, or if anything about the decode fails: a slightly
 * oversized upload beats a failed one.
 */
async function downscaleImage(blob: Blob): Promise<Blob> {
  if (blob.type === "image/svg+xml" || blob.type === "image/gif") return blob;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return blob;
  }

  try {
    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    if (scale === 1 && blob.size <= SIZE_FLOOR) return blob;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const encoded = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    // Re-encoding can inflate an already-well-compressed image; keep the smaller.
    return encoded && encoded.size < blob.size ? encoded : blob;
  } catch {
    return blob;
  } finally {
    bitmap.close();
  }
}

/**
 * Process an image file for upload — converts HEIC/HEIF to JPEG, downscales
 * oversized photos, then reads the result as a base64 data URL.
 *
 * Returns { preview: string (data URL), base64: string (raw base64) }
 */
export async function processImageFile(
  file: File
): Promise<{ preview: string; base64: string }> {
  let blob: Blob = file;

  // Convert HEIC/HEIF to JPEG (browsers don't natively render these)
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name);

  if (isHeic) {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    blob = Array.isArray(converted) ? converted[0] : converted;
  }

  blob = await downscaleImage(blob);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ preview: result, base64: result.split(",")[1] });
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(blob);
  });
}

/** Accept string for file inputs — includes HEIC/HEIF alongside standard formats */
export const IMAGE_ACCEPT = "image/*,.heic,.heif";
