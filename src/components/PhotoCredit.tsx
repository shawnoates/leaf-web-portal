/**
 * "Photo: <name> / Unsplash" on an Unsplash photo, bottom right. Unsplash's
 * API terms ask that the photographer and Unsplash be credited and linked
 * wherever the photo is shown, with Leaf's referral tags on the links.
 */
const REF = "utm_source=leaf&utm_medium=referral";

export function PhotoCredit({ credit }: { credit: { name: string; url: string } }) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <span className="absolute bottom-2 right-2 z-10 rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
      Photo:{" "}
      <a href={`${credit.url}?${REF}`} target="_blank" rel="noopener noreferrer" onClick={stop} className="underline-offset-2 hover:underline">
        {credit.name}
      </a>
      {" / "}
      <a href={`https://unsplash.com/?${REF}`} target="_blank" rel="noopener noreferrer" onClick={stop} className="underline-offset-2 hover:underline">
        Unsplash
      </a>
    </span>
  );
}
