import { Loader2, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_1px_2px_rgba(0,0,0,.18)] hover:brightness-110",
  secondary: "border border-rule bg-sheet text-ink hover:bg-sheet-2",
  ghost: "text-ink-2 hover:bg-sheet-2 hover:text-ink",
  danger:
    "bg-danger text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,.18)] hover:brightness-110",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-4 text-base",
  lg: "min-h-13 px-6 text-lg",
};

// Shared with router links that must look like buttons.
export function buttonClasses(variant: Variant = "primary", size: Size = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-control py-2 font-semibold select-none",
    "transition-[transform,background-color,filter] duration-150 ease-out-soft active:scale-[.97]",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
  );
}

export function Button({
  variant,
  size,
  icon,
  loading = false,
  className,
  type = "button",
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Leading icon. */
  icon?: LucideIcon;
  /** Disables the button and shows a spinner while a request is running. */
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClasses(variant, size), className)}
      {...props}
    >
      {loading ? (
        <Icon icon={Loader2} className="animate-spin" />
      ) : (
        icon && <Icon icon={icon} />
      )}
      {children}
    </button>
  );
}
