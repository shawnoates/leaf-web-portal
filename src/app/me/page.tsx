import type { Metadata } from "next";
import MeClient from "./MeClient";

export const metadata: Metadata = {
  title: "Your plans · Leaf",
  robots: { index: false, follow: false },
};

export default function MePage() {
  return <MeClient />;
}
