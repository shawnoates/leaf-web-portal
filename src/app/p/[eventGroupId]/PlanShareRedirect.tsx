"use client";

import { useEffect } from "react";

export default function PlanShareRedirect({
  destination,
}: {
  destination: string;
}) {
  useEffect(() => {
    // Use replace so the share URL doesn't pollute browser history.
    window.location.replace(destination);
  }, [destination]);

  return null;
}
