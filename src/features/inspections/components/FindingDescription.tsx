"use client";

import { useState } from "react";

export function FindingDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = description.length > 180;

  return (
    <div className={s.wrapper}>
      <p className={`${s.description} ${canExpand && !expanded ? s.clamped : ""}`}>
        {description}
      </p>
      {canExpand ? (
        <button
          type="button"
          className={s.expandButton}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Ver menos" : "Ver más"}
        </button>
      ) : null}
    </div>
  );
}

const s = {
  wrapper: "mt-1 min-w-0",
  description: "break-words text-sm leading-6 text-secondary-foreground",
  clamped: "line-clamp-3",
  expandButton: "mt-1 min-h-11 rounded-sm text-sm font-medium text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
};
