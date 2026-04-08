// Client-side Parse SDK initialization (for "use client" components)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- parse has incomplete type declarations
import Parse from "parse";

const PARSE_APP_ID = process.env.NEXT_PUBLIC_PARSE_APP_ID || "";
const PARSE_JS_KEY = process.env.NEXT_PUBLIC_PARSE_JS_KEY || "";
const PARSE_SERVER_URL =
  process.env.NEXT_PUBLIC_PARSE_SERVER_URL || "https://api.getleaflets.co/parse";

if (typeof window !== "undefined") {
  Parse.initialize(PARSE_APP_ID, PARSE_JS_KEY);
  Parse.serverURL = PARSE_SERVER_URL;
}

export default Parse;
