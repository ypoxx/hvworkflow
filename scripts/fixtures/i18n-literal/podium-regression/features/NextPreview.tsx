// Reproduces the exact shape of the false positive round 1, M6 fixed in
// apps/web/src/features/stage/Podium.tsx's real NextPreview component (see its own comment at the
// <button> below) — a multi-line `{/* ... */}` JSX comment whose prose mentions tag names in
// backticks, immediately followed by real, literal-free markup. Before the comment-masking fix, the
// scanner read the comment's own text as if it were real JSX, and misread "Podium" it as containing a
// tag close.
export function NextPreview() {
  return (
    <button type="button">
      {/* m9 (review round 1): no block-level `<div>`/`<p>` inside a `<button>` — `<span>` with the
       *  same layout classes renders identically and stays valid HTML. */}
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-2xs tabular-nums text-ink-500" />
      </span>
    </button>
  );
}
