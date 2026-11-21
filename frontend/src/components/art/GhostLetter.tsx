import { cx } from "../cx";

/**
 * A giant Cyrillic letter ghosted into the background at 4 to 6 percent
 * opacity. Position it with `className` (absolute, offsets, a width); it is
 * decoration only and ignores pointer events.
 */
export function GhostLetter({
  letter,
  className,
}: {
  letter: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={cx(
        "pointer-events-none absolute aspect-square overflow-visible select-none",
        className,
      )}
    >
      <text
        x="50"
        y="82"
        textAnchor="middle"
        fontSize="104"
        fontWeight="600"
        fontFamily="var(--font-serif)"
        fill="var(--ink)"
        opacity="0.05"
      >
        {letter}
      </text>
    </svg>
  );
}
