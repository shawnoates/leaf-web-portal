import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_URL } from "@/lib/site";

/**
 * Fonts for next/og cards (Satori takes no stylesheets or app fonts): read
 * from the build's public/fonts, else fetched from the live site. A face that
 * can't load is left out rather than failing the card.
 */
const fontCache = new Map<string, Promise<ArrayBuffer | null>>();
export function loadFont(file: string): Promise<ArrayBuffer | null> {
  let p = fontCache.get(file);
  if (!p) {
    p = readFile(join(process.cwd(), "public/fonts", file))
      .then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
      .catch(() => fetch(`${SITE_URL}/fonts/${file}`).then((r) => (r.ok ? r.arrayBuffer() : null)))
      .catch(() => null)
      .then((buf) => {
        if (!buf) fontCache.delete(file); // try again next request
        return buf;
      });
    fontCache.set(file, p);
  }
  return p;
}

/** Friend Mode's faces: Instrument Serif for display, Manrope for the rest. */
export async function friendModeFonts() {
  const [serif, sans, sansBold] = await Promise.all([
    loadFont("InstrumentSerif-Regular.ttf"),
    loadFont("Manrope-400.woff"),
    loadFont("Manrope-600.woff"),
  ]);
  const fonts = [
    serif && { name: "Instrument Serif", data: serif, weight: 400 as const, style: "normal" as const },
    sans && { name: "Manrope", data: sans, weight: 400 as const, style: "normal" as const },
    sansBold && { name: "Manrope", data: sansBold, weight: 600 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => Boolean(f));
  return { fonts, hasSerif: Boolean(serif), hasSans: Boolean(sans) };
}
