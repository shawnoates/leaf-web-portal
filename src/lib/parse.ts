// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- parse/node has no type declarations
import Parse from "parse/node";

const PARSE_APP_ID = process.env.NEXT_PUBLIC_PARSE_APP_ID || "";
const PARSE_JS_KEY = process.env.NEXT_PUBLIC_PARSE_JS_KEY || "";
const PARSE_SERVER_URL =
  process.env.NEXT_PUBLIC_PARSE_SERVER_URL || "https://api.getleaflets.co/parse";

if (!Parse.applicationId) {
  Parse.initialize(PARSE_APP_ID, PARSE_JS_KEY);
  Parse.serverURL = PARSE_SERVER_URL;
}

export default Parse;
