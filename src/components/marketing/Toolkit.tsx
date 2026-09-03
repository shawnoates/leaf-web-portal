"use client";

// "The planner's toolkit, finally" — 3×2 feature grid on the alternate
// background band. No icons, per the spec: the old lucide tiles were
// carrying no information the titles didn't already state.

export interface ToolkitItem {
  title: string;
  body: string;
}

export default function Toolkit({
  items,
  heading,
}: {
  items: ToolkitItem[];
  heading: string;
}) {
  return (
    <section
      className="px-5 py-12 sm:px-12 sm:py-[88px]"
      style={{ background: "var(--mkt-bg-alt)" }}
    >
      <div className="mx-auto max-w-[1440px]">
        <div className="mkt-eyebrow">Everything you need</div>
        <h2
          className="mkt-serif m-0 mb-7 mt-1.5 italic sm:mb-11 sm:mt-2"
          style={{ fontSize: "clamp(30px, 3.1vw, 44px)", lineHeight: 1.1 }}
        >
          {heading}
        </h2>
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-12 lg:gap-y-10">
          {items.map((item) => (
            <div key={item.title}>
              <div className="text-[16px] font-semibold sm:text-[17px]">
                {item.title}
              </div>
              <div
                className="mt-1.5 text-[14px] leading-[1.55] sm:text-[14.5px]"
                style={{ color: "var(--mkt-ink-2)" }}
              >
                {item.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
