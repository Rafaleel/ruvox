import type { ReactNode } from "react";
import { cx } from "../cx";

/** The four edges, in the SVG's own box: a line of holes punched along each. */
const edges = [
  { x1: "0", x2: "100%", y1: "0", y2: "0" },
  { x1: "0", x2: "100%", y1: "100%", y2: "100%" },
  { x1: "0", x2: "0", y1: "0", y2: "100%" },
  { x1: "100%", x2: "100%", y1: "0", y2: "100%" },
];

/**
 * A gold foil postage stamp: perforated edge, a printed inner frame and its
 * children. The holes show whatever sits behind (`--stamp-cut`, the sheet
 * colour by default). Set `tilt` for the slightly crooked look of a real stamp.
 */
export function StampFrame({
  children,
  tilt = false,
  className,
}: {
  children: ReactNode;
  tilt?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "stamp-frame relative bg-(image:--foil) text-gold-ink",
        tilt && "-rotate-2",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
        stroke="var(--stamp-cut, var(--sheet))"
        strokeWidth="0.4em"
        strokeLinecap="round"
        strokeDasharray="0 0.8em"
      >
        {edges.map((edge) => (
          <line key={`${edge.x1}${edge.x2}${edge.y1}`} {...edge} />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-[0.55em] rounded-[0.2em] border border-gold/60" />
      <div className="relative">{children}</div>
    </div>
  );
}
