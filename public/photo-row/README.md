# photo-row

Images for the fanned photo row under the `/personal` hero
(`src/app/personal/PhotoGrid.tsx`). Filenames are referenced literally by that
component — to swap one, drop a replacement in with the same name, or edit the
`PHOTOS` array.

| File | Scene |
| --- | --- |
| `kitchen-dinner.jpg` | Friends cooking and pouring wine in a kitchen at night |
| `backyard-lunch.jpg` | A long backyard lunch, one friend pouring drinks |
| `trail-hike.jpg` | Hikers pulling each other up a wooded trail |
| `restaurant-dinner.jpg` | A packed restaurant table mid-laugh |
| `pickup-soccer.jpg` | Pickup soccer on a lot at sunset |
| `bar-night.jpg` | A group crowded into a bar booth |
| `bike-ride.jpg` | Three friends riding along a river path |
| `skatepark.jpg` | Friends cheering on a skater |

## Prep

Current set: **480×640 (3:4), JPEG q80, 68–119 KB each** (~750 KB total).

- **Portrait 3:4.** The cards render 128px wide (mobile) up to 160px (xl) at
  `aspect-[3/4]`, so 480px covers @3x. Larger is wasted bytes.
- **Compress manually.** No build-time image pipeline exists in this repo (no
  `next/image`, no sharp step). Target **80–150 KB** per file. `sips` is enough:

  ```sh
  sips -s format jpeg -s formatOptions 80 --resampleWidth 480 in.png --out tmp.jpg
  sips -c 640 480 tmp.jpg --out out.jpg   # center-crop to 3:4
  ```

- **Check every image at full size before shipping** — warped hands/faces,
  nonsense background text, or a glossy stock-photo look defeats the whole
  point of this section.
- Keep the people plausibly diverse in age and background; the positioning is
  "your friend group", not one demographic.
- Order in `PHOTOS` alternates day/night and indoor/outdoor on purpose — keep
  that rhythm when swapping images in.

If a file goes missing the component drops that card from the row (see its
`onError` handler), so a partial set never renders a broken tile.
