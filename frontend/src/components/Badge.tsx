import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

type Tone = "neutral" | "accent" | "gold" | "success" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-sheet-2 text-ink-2",
  accent: "bg-accent text-on-accent",
  gold: "bg-gold-soft text-gold-ink",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
};

/** Small pill for a status or a count. */
export function Badge({
  tone = "neutral",
  icon,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; icon?: LucideIcon }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    >
      {icon && <Icon icon={icon} size={14} />}
      {children}
    </span>
  );
}
