import type { Metadata } from "next";
import FriendsClient from "./FriendsClient";

export const metadata: Metadata = {
  title: "Friend Mode · Leaf",
  description:
    "Start a crew in a minute. Leaf finds a night that works around everyone's calendars, picks the place, asks who's in, and keeps the group seeing each other.",
};

/** /friends: Friend Mode's landing page, where anyone can start a crew. */
export default function FriendsPage() {
  return <FriendsClient />;
}
