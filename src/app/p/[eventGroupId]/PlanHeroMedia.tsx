"use client";

import HlsVideo from "@/components/HlsVideo";

// The card's hero: the invitation video when there is one, the image
// otherwise. The poster is the same clean frame the Home card and the share
// card use, so nothing here shows the play-button-burned-in thumbnail that
// `image` carries for imported plans. If playback can't be set up, HlsVideo
// leaves the poster as a plain image.
export default function PlanHeroMedia({
  image,
  videoUrl,
}: {
  image: string | null;
  videoUrl: string | null;
}) {
  if (videoUrl) {
    return (
      <div className="w-full aspect-[4/3] bg-zinc-900">
        <HlsVideo src={videoUrl} poster={image} className="w-full h-full object-cover" />
      </div>
    );
  }
  if (image) {
    return (
      <div
        className="w-full aspect-[4/3] bg-zinc-200 bg-cover bg-center"
        style={{ backgroundImage: `url(${image})` }}
      />
    );
  }
  return <div className="w-full aspect-[4/3] bg-zinc-200" />;
}
