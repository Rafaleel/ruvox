import type { LucideIcon, LucideProps } from "lucide-react";

type IconProps = Omit<LucideProps, "ref"> & {
  icon: LucideIcon;
  /** Accessible name; icons are decorative (hidden from screen readers) without it. */
  label?: string;
};

/** Pixel sizes (numbers) become rem so icons scale with the fluid root size; strings pass through. */
const toRem = (size: number | string) =>
  typeof size === "number" ? `${size / 16}rem` : size;

/** Lucide icon with the design system defaults: 1.25rem, 1.75 stroke. */
export function Icon({
  icon: Glyph,
  size = "1.25rem",
  strokeWidth = 1.75,
  label,
  ...props
}: IconProps) {
  return (
    <Glyph
      size={toRem(size)}
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
      {...props}
    />
  );
}
