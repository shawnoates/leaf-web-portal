import type { Metadata } from "next";
import FriendsClient from "./FriendsClient";

export const metadata: Metadata = {
  title: "Friend Mode · Leaf",
  description:
    "Leaf finds a night that works for your friends and plans it. Add your people; Leaf picks the place, asks who's in, and keeps the group seeing each other.",
};

/** /friends — the Friend Mode marketing page. */
export default function FriendsPage() {
  return <FriendsClient />;
}
