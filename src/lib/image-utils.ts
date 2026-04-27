/**
 * Process an image file for upload — converts HEIC/HEIF to JPEG, then
 * reads the result as a base64 data URL.
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
