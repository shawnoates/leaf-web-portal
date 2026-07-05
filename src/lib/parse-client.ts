// Client-side Parse SDK initialization (for "use client" components)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- parse has incomplete type declarations
import Parse from "parse";

const PARSE_APP_ID = process.env.NEXT_PUBLIC_PARSE_APP_ID || "";
const PARSE_JS_KEY = process.env.NEXT_PUBLIC_PARSE_JS_KEY || "";
const PARSE_SERVER_URL =
  process.env.NEXT_PUBLIC_PARSE_SERVER_URL || "https://ali.joinleaf.com/parse";

// Initialize on both server and client — NEXT_PUBLIC_ vars are available in both
if (PARSE_APP_ID) {
  Parse.initialize(PARSE_APP_ID, PARSE_JS_KEY);
  Parse.serverURL = PARSE_SERVER_URL;
} else if (typeof window !== "undefined") {
  console.error(
    "Parse: NEXT_PUBLIC_PARSE_APP_ID is not set. Set it in your hosting environment variables."
  );
}

// Expose Parse on window so devtools console can call Parse.Cloud.run
// directly for diagnostics / one-off inspections. No security impact —
// the JS key already ships to the browser via the environment vars
// above, so an authenticated user could reconstruct it from any
// network request. Making it addressable in the console just skips a
// couple of steps.
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as unknown as { Parse: unknown }).Parse = Parse;
}

export default Parse;
