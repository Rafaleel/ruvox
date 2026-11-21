import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

/** A number with a label. `tone="gold"` is the "stamp" used for streaks. */
export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "gold";
  className?: string;
}) {
  const gold = tone === "gold";
  return (
    <div
      className={cx(
        "rounded-card p-4",
        gold
          ? "bg-gold-soft text-gold-ink outline-2 -outline-offset-6 outline-gold/50 outline-dashed"
          : "bg-sheet shadow-card",
        className,
      )}
    >
      <p
        className={cx(
          "flex items-center gap-1.5 text-sm font-medium",
          gold ? "text-gold-ink" : "text-ink-2",
        )}
      >
        {icon && (
          <Icon icon={icon} size={16} className={gold ? "" : "text-ink-3"} />
        )}
        {label}
      </p>
      <p
        className={cx(
          "mt-1 font-serif text-4xl leading-none font-semibold",
          gold ? "text-gold-ink" : "text-ink",
        )}
      >
        {value}
      </p>
      {hint && (
        <p
          className={cx(
            "mt-1.5 text-sm",
            gold ? "text-gold-ink" : "text-ink-3",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
