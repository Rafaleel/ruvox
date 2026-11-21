import { cx } from "../cx";

/**
 * A dog-eared page corner for the bottom right of a paper card. Place it in a
 * `relative` parent; it is decoration only.
 */
export function NotebookCorner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      className={cx(
        "pointer-events-none absolute right-0 bottom-0 size-[2.25em]",
        className,
      )}
    >
      <path d="M40 0 V40 H0 Z" fill="var(--paper)" />
      <path d="M40 0 L0 40 H40 Z" fill="var(--sheet-2)" />
      <path
        d="M40 0 L0 40"
        stroke="var(--rule)"
        strokeWidth="1"
        opacity="0.5"
        fill="none"
      />
      <path
        d="M30 40 L40 30 M22 40 L40 22"
        stroke="var(--hairline)"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}
