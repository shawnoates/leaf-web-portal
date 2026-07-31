# photo-row

Images for the fanned photo row under the `/personal` hero
(`src/app/personal/PhotoGrid.tsx`). Filenames are referenced literally by that
component — add a file here with the exact name, or edit the `PHOTOS` array.

| File | Scene |
| --- | --- |
| `group-dinner-1.jpg` | Friends laughing around a crowded dinner table |
| `coffee-walk-1.jpg` | A small group walking together with coffees in hand |
| `game-night-1.jpg` | Friends crowded around a table mid-game night |
| `park-hangout-1.jpg` | A group sprawled on a blanket in the park |
| `rooftop-1.jpg` | Friends gathered on a rooftop at sunset |
| `run-club-1.jpg` | A run club after a morning route |
| `potluck-1.jpg` | Friends passing dishes around a potluck spread |
| `birthday-1.jpg` | A group crowding in around a birthday cake |

## Prep

- **Portrait, ~9:16.** Cards render at 128×224 (mobile) up to 160×288 (xl), so
  ~360×640 covers @2x. Anything larger is wasted bytes.
- **Compress manually.** No build-time image pipeline exists in this repo (no
  `next/image`, no sharp step). Target **80–150 KB** per file, not raw
  generation-resolution PNGs.
- **Check every image at full size before shipping** — warped hands/faces,
  nonsense background text, or a glossy stock-photo look defeats the whole
  point of this section.
- Keep the people plausibly diverse in age and background; the positioning is
  "your friend group", not one demographic.

Until a file lands here the component drops that card from the row (see its
`onError` handler), so partial sets are safe to ship.
