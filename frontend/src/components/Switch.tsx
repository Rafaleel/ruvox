import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

/** On/off toggle. Name it with `aria-label` or `aria-labelledby`. */
export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "role"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cx(
        // The ::before widens the touch target to 44px without changing the look.
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-150 before:absolute before:-inset-2 before:content-['']",
        "disabled:pointer-events-none disabled:opacity-50",
        checked ? "border-accent bg-accent" : "border-rule bg-sheet-2",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cx(
          "size-5 rounded-full shadow-sm transition-transform duration-150 ease-out-soft",
          checked
            ? "translate-x-[1.375rem] bg-on-accent"
            : "translate-x-0.5 bg-ink-3",
        )}
      />
    </button>
  );
}
