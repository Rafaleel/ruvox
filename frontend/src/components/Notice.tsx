import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

type Tone = "info" | "success" | "warning" | "danger";

const tones = {
  info: { icon: Info, box: "bg-sheet-2", mark: "text-ink-2" },
  success: { icon: CircleCheck, box: "bg-success-soft", mark: "text-success" },
  warning: { icon: TriangleAlert, box: "bg-gold-soft", mark: "text-gold-ink" },
  danger: { icon: CircleAlert, box: "bg-danger-soft", mark: "text-danger" },
} as const;

/** Inline message. Danger is announced as an alert, the others politely. */
export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { icon, box, mark } = tones[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx("flex gap-3 rounded-card p-4", box, className)}
    >
      <Icon icon={icon} className={cx("mt-0.5 shrink-0", mark)} />
      <div className="min-w-0 text-ink">
        {title && <p className={cx("font-semibold", mark)}>{title}</p>}
        {children && <div className={cx(title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}
