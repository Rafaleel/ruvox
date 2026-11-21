import type { HTMLAttributes } from "react";
import { cx } from "./cx";

/** A sheet of paper. `margin` adds the notebook's red margin line on the left. */
export function Card({
  margin = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { margin?: boolean }) {
  return (
    <div
      className={cx(
        "rounded-card bg-sheet p-5 shadow-card",
        margin && "margin-rule pl-9",
        className,
      )}
      {...props}
    />
  );
}
