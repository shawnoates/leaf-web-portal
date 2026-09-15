"use client";

import { useState } from "react";
import InterestPrompt, { type InterestPromptItem } from "@/components/InterestPrompt";

const ITEMS: InterestPromptItem[] = [
  { id: "idea:1", title: "Sunday Pancake Breakfast", dateLabel: "Sun, Sep 21", place: "Upper West Side", image: "https://picsum.photos/seed/pancake/800/500" },
  { id: "idea:2", title: "Picnic on the Riverside lawn", dateLabel: "Sat, Sep 27", place: "Riverside Park", image: "https://picsum.photos/seed/picnic/800/500" },
  { id: "idea:3", title: "Board games at Hex & Co.", dateLabel: "Thu, Oct 2", place: "Upper West Side", image: null },
  { id: "ai:0", title: "Coffee after the long run", dateLabel: "Sun, Oct 5", place: "Fort Greene", image: "https://picsum.photos/seed/coffee/800/500" },
  { id: "ai:1", title: "Trail day upstate with a very long title that wraps to more than two lines", dateLabel: "Sat, Oct 11", place: "Cold Spring", image: "https://picsum.photos/seed/trail/800/500" },
  { id: "ai:2", title: "Stretch and strength hour", dateLabel: "Mon, Oct 13", place: "Gowanus", image: "https://picsum.photos/seed/stretch/800/500" },
];

export default function Preview() {
  const [marked, setMarked] = useState<Set<string>>(() => new Set(["idea:2"]));
  const [open, setOpen] = useState(true);
  return (
    <div style={{ minHeight: "150vh", padding: 40 }}>
      <button onClick={() => setOpen(true)}>open</button>
      {open && (
        <InterestPrompt
          calendarName="Brooklyn Run Club"
          items={ITEMS}
          marked={marked}
          pending={new Set()}
          onToggle={(id) =>
            setMarked((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onDone={() => setOpen(false)}
          onSkip={() => setOpen(false)}
        />
      )}
    </div>
  );
}
