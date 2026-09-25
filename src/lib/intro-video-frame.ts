/**
 * How big a box a host's intro video gets, from the shape Mux stored.
 *
 * The first version assumed every take was shot upright and forced a 9:16
 * box with `object-cover`. A phone that hands the browser landscape frames
 * — iPhones do, even held upright — then had its take cropped to a tall
 * slice on every page, and the poster's smart-crop zoomed that slice onto
 * one eye. The box now follows the video: portrait takes keep the compact
 * side-by-side column, landscape takes go full width above the text.
 *
 * `aspectRatio` is Mux's "W:H" string; anything unparseable falls back to
 * portrait, which is the shape the prompts ask for.
 */
export function introVideoFrame(aspectRatio: string | null | undefined): {
  landscape: boolean;
  className: string;
  style: { aspectRatio: string };
} {
  const m = /^(\d+):(\d+)$/.exec(aspectRatio ?? "");
  const w = m ? Number(m[1]) : 9;
  const h = m ? Number(m[2]) : 16;
  const landscape = w > h;
  return {
    landscape,
    className: landscape
      ? "basis-full w-full max-w-[320px] overflow-hidden rounded-xl bg-zinc-900"
      : "w-[132px] shrink-0 overflow-hidden rounded-xl bg-zinc-900",
    style: { aspectRatio: `${w} / ${h}` },
  };
}
