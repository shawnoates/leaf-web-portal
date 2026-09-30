/* eslint-disable @next/next/no-img-element */

// Shows the whole image (no crop), with a blurred, zoomed copy of itself
// filling the leftover space so the panel never looks empty.
export default function FittedImage({ src, alt = "" }: { src: string; alt?: string }) {
  return (
    <div className="relative w-full h-full overflow-hidden bg-zinc-900">
      <img
        src={src}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-70"
      />
      <img src={src} alt={alt} className="relative w-full h-full object-contain" />
    </div>
  );
}
