import type { LucideIcon } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
};

/** One choice out of a few. Radio-group semantics: arrow keys move and select. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  /** Accessible name of the group. */
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `lg` is a roomier control for a screen's main choice. */
  size?: "md" | "lg";
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (event: KeyboardEvent, from: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    if (!step) return;
    event.preventDefault();
    const next = (from + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        "inline-flex gap-1 rounded-control bg-sheet-2 p-1 shadow-[inset_0_0_0_1px_var(--hairline)]",
        className,
      )}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[i] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => move(event, i)}
            className={cx(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)-4px)] font-semibold transition-[background-color,box-shadow] duration-150",
              size === "lg"
                ? "min-h-12 px-5 font-serif text-xl"
                : "min-h-9 px-3.5 text-sm",
              selected
                ? "bg-sheet text-ink shadow-card"
                : "text-ink-2 hover:text-ink",
            )}
          >
            {option.icon && <Icon icon={option.icon} size={16} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
