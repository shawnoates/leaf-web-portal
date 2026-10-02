import type { Metadata } from "next";
import HandlesClient from "./HandlesClient";

// Where someone gets paid back (Venmo / Cash App / PayPal / Zelle), on its
// own page. Reached from a signed link (`?u=&vt=`, like /me's) in the text a
// guest gets when their paid seat goes back up for someone else to take, so
// the replacement can pay them instead of the host.

type PageProps = { searchParams: Promise<{ u?: string; vt?: string }> };

export const metadata: Metadata = {
  title: "Where you get paid · Leaf",
  description: "Add the Venmo, Cash App, PayPal or Zelle you get paid back on.",
  robots: { index: false, follow: false },
};

export default async function PayHandlesPage({ searchParams }: PageProps) {
  const { u, vt } = await searchParams;
  return <HandlesClient viewer={u && vt ? { userId: u, token: vt } : null} />;
}
