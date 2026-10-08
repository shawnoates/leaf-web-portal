/**
 * Remember a merchant's link on this device, so coming back to /partner or
 * /partners/login offers their dashboard without hunting for the email.
 * Browser storage only: per device, can vanish, never required. The link
 * itself stays the key; this just keeps it handy.
 */

const KEY = "leaf.partnerLink";

export type RememberedPartner = { token: string; name: string };

export function rememberPartner(token: string, name: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, name, at: Date.now() }));
  } catch {
    // Private mode or blocked storage: nothing to remember, nothing breaks.
  }
}

export function rememberedPartner(): RememberedPartner | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v && typeof v.token === "string" && v.token.length >= 20 ? { token: v.token, name: String(v.name || "") } : null;
  } catch {
    return null;
  }
}

/** Forget it (Not you?, or a link that no longer works). With a token, only if it's that one. */
export function forgetPartner(token?: string) {
  try {
    if (!token || rememberedPartner()?.token === token) localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
