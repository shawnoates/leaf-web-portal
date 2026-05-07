export interface DefaultCover {
  id: string;
  name: string;
  /** CSS gradient string for inline rendering (no upload needed). */
  gradient: string;
  /** Solid SVG for upload — rasterized to PNG client-side before sending. */
  svg: string;
}

function makeSvg(from: string, to: string, accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient></defs><rect width="800" height="400" fill="url(#g)"/><circle cx="640" cy="90" r="140" fill="${accent}" opacity="0.22"/><circle cx="140" cy="330" r="90" fill="${accent}" opacity="0.16"/></svg>`;
}

export const DEFAULT_COVERS: DefaultCover[] = [
  {
    id: "dining",
    name: "Dining",
    gradient: "linear-gradient(135deg, #f59e0b, #ea580c)",
    svg: makeSvg("#f59e0b", "#ea580c", "#fff7ed"),
  },
  {
    id: "drinks",
    name: "Drinks",
    gradient: "linear-gradient(135deg, #0ea5e9, #1e40af)",
    svg: makeSvg("#0ea5e9", "#1e40af", "#e0f2fe"),
  },
  {
    id: "music",
    name: "Music",
    gradient: "linear-gradient(135deg, #a855f7, #db2777)",
    svg: makeSvg("#a855f7", "#db2777", "#fdf4ff"),
  },
  {
    id: "art",
    name: "Art",
    gradient: "linear-gradient(135deg, #fb7185, #f97316)",
    svg: makeSvg("#fb7185", "#f97316", "#fff1f2"),
  },
  {
    id: "outdoors",
    name: "Outdoors",
    gradient: "linear-gradient(135deg, #10b981, #0d9488)",
    svg: makeSvg("#10b981", "#0d9488", "#ecfdf5"),
  },
  {
    id: "fitness",
    name: "Fitness",
    gradient: "linear-gradient(135deg, #ef4444, #c2410c)",
    svg: makeSvg("#ef4444", "#c2410c", "#fef2f2"),
  },
  {
    id: "social",
    name: "Social",
    gradient: "linear-gradient(135deg, #6366f1, #2563eb)",
    svg: makeSvg("#6366f1", "#2563eb", "#eef2ff"),
  },
  {
    id: "learning",
    name: "Learning",
    gradient: "linear-gradient(135deg, #facc15, #f59e0b)",
    svg: makeSvg("#facc15", "#f59e0b", "#fefce8"),
  },
];

export function getDefaultCoverForSeed(seed: string): DefaultCover {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % DEFAULT_COVERS.length;
  return DEFAULT_COVERS[idx];
}

/**
 * Rasterize an SVG string to a PNG data URL via offscreen canvas.
 * Returns { preview, base64 } shaped like processImageFile so callers can
 * reuse the same imageBase64 + imagePreview state path.
 */
export async function rasterizeSvgToPng(
  svg: string,
  width = 800,
  height = 400,
): Promise<{ preview: string; base64: string }> {
  const svgUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
  const img = new Image();
  img.decoding = "async";
  img.src = svgUrl;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, width, height);

  const preview = canvas.toDataURL("image/png");
  return { preview, base64: preview.split(",")[1] };
}
