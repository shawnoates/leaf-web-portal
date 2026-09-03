"use client";

import Parse from "@/lib/parse-client";
import { makeClientValue } from "./useClientValue";

// Whether someone is signed in — drives the nav's "Log in" vs
// "Dashboard" and where the pricing CTAs point. Read through a client
// snapshot so SSR renders the logged-out shell and hydration doesn't
// mismatch.

const session = makeClientValue(() => !!Parse.User.current(), false);

export function useIsLoggedIn(): boolean {
  return session.use();
}
