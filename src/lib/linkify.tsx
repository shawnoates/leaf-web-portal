import { Fragment } from "react";

type LinkifyOptions = {
  /** Show each link as its host ("resy.com") instead of the full URL. */
  hostOnly?: boolean;
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function renderLinkedText(text: string, { hostOnly = false }: LinkifyOptions = {}) {
  const parts = text.split(/(https?:\/\/[^\s<>"']+)/g);
  return parts.map((part, i) => {
    if (!/^https?:\/\//.test(part)) return <Fragment key={i}>{part}</Fragment>;
    const trailing = part.match(/[.,;:!?)\]}]+$/)?.[0] ?? "";
    const url = trailing ? part.slice(0, -trailing.length) : part;
    return (
      <Fragment key={i}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-700 underline hover:text-emerald-800 break-words"
        >
          {hostOnly ? hostOf(url) : url}
        </a>
        {trailing}
      </Fragment>
    );
  });
}
