import localFont from "next/font/local";

// The site's typefaces, bundled here (latin subset, woff2; licenses in
// LICENSES.txt) rather than pulled by next/font/google, which downloads them
// on every build: a flaky Google Fonts fetch failed Amplify builds with
// "Module not found" on the font CSS (2026-10-31). Same families, weights and
// CSS variables as before.

export const inter = localFont({
  src: "./Inter.woff2",
  weight: "100 900",
  variable: "--font-geist-sans",
});

// Marketing typeface set — used by /personal and /organizations via the
// `.mkt` scope in globals.css.
export const manrope = localFont({
  src: "./Manrope.woff2",
  weight: "200 800",
  variable: "--font-manrope",
});

export const instrumentSerif = localFont({
  src: [
    { path: "./InstrumentSerif.woff2", weight: "400", style: "normal" },
    { path: "./InstrumentSerif-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument-serif",
  adjustFontFallback: "Times New Roman",
});

export const jetbrainsMono = localFont({
  src: "./JetBrainsMono.woff2",
  weight: "100 800",
  variable: "--font-jetbrains-mono",
  fallback: ["ui-monospace", "monospace"],
  adjustFontFallback: false,
});

// Share-kit headline (post-follow modal, /me card). Variable font; the
// optical-size axis is what makes it read as a display face at 24–32px.
export const newsreader = localFont({
  src: "./Newsreader.woff2",
  weight: "200 800",
  variable: "--font-newsreader",
  adjustFontFallback: "Times New Roman",
});

/** The placard welcome sheet's face. */
export const instrumentSans = localFont({
  src: "./InstrumentSans.woff2",
  weight: "400 700",
});
