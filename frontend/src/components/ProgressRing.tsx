import type { ReactNode } from "react";
import { cx } from "./cx";

/** Circular progress: `value` out of `total`, with optional content in the middle. */
export function ProgressRing({
  value,
  total,
  label,
  size = 64,
  strokeWidth = 6,
  children,
  className,
}: {
  value: number;
  total: number;
  /** Accessible name; defaults to "value de total". */
  label?: string;
  /** In design pixels at the 16px root; the ring scales with the root size. */
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  const done = total > 0 && value >= total;
  return (
    <div
      role="img"
      aria-label={label ?? `${value} de ${total}`}
      className={cx(
        "relative inline-grid shrink-0 place-items-center",
        className,
      )}
      style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-sheet-2"
        />
        {fraction > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            className={done ? "stroke-success" : "stroke-accent"}
          />
        )}
      </svg>
      {children && (
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center text-center leading-none"
        >
          {children}
        </span>
      )}
    </div>
  );
}
