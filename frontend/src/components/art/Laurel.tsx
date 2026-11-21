import type { ReactNode } from "react";
import { cx } from "../cx";

const CX = 50;
const CY = 52;
const R = 36;
const STATIONS = 8;

/** Leaves of the left branch; the right branch mirrors it. */
const leaves = Array.from({ length: STATIONS }, (_, i) => {
  // Angle from the bottom of the wreath, going up the left side.
  const t = i / (STATIONS - 1);
  const theta = (8 + t * 150) * (Math.PI / 180);
  const x = CX - R * Math.sin(theta);
  const y = CY + R * Math.cos(theta);
  // The tangent points up and round the circle; leaves fan to both sides of it.
  const tangent = Math.atan2(-R * Math.sin(theta), -R * Math.cos(theta));
  const deg = (tangent * 180) / Math.PI + 90;
  const scale = 0.8 + 0.35 * Math.sin(t * Math.PI);
  return { x, y, deg, scale, key: i };
});

const stem = (() => {
  const a = (d: number) => (d * Math.PI) / 180;
  const p = (d: number) =>
    `${(CX - R * Math.sin(a(d))).toFixed(2)} ${(CY + R * Math.cos(a(d))).toFixed(2)}`;
  return `M${p(4)} A${R} ${R} 0 0 1 ${p(166)}`;
})();

/**
 * A gold line-art laurel wreath around its children (a number or a stamp).
 * It is square and fills the width of its parent.
 */
export function Laurel({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative grid aspect-square place-items-center",
        className,
      )}
    >
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        focusable="false"
        className="absolute inset-0 size-full overflow-visible"
        fill="none"
        stroke="var(--gold)"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {[false, true].map((mirror) => (
          <g
            key={String(mirror)}
            transform={mirror ? "translate(100 0) scale(-1 1)" : undefined}
          >
            <path d={stem} />
            {leaves.map(({ x, y, deg, scale, key }) =>
              [-38, 38].map((fan) => (
                <path
                  key={`${key}${fan}`}
                  d="M0 0 C4.5 -3.5 4.5 -10.5 0 -15 C-4.5 -10.5 -4.5 -3.5 0 0Z"
                  fill="var(--gold-soft)"
                  transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(deg + fan).toFixed(1)}) scale(${scale.toFixed(2)})`}
                />
              )),
            )}
          </g>
        ))}
      </svg>
      <div className="relative z-10 grid place-items-center">{children}</div>
    </div>
  );
}
