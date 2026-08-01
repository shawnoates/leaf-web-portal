// TEMPORARY — visual QA harness for PhotoGrid. Delete after review.
import PhotoGrid from "../personal/PhotoGrid";

export default function PhotoRowQA() {
  return (
    <div>
      <div className="bg-zinc-900 h-24" />
      <PhotoGrid />
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <p className="text-xs tracking-wider uppercase text-zinc-500 font-semibold">
            Who it&apos;s for
          </p>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight">
            The friend who&apos;s <span className="italic">always</span> the planner.
          </h2>
        </div>
      </section>
    </div>
  );
}
