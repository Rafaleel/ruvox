import type { LucideIcon, LucideProps } from "lucide-react";

type IconProps = Omit<LucideProps, "ref"> & {
  icon: LucideIcon;
  /** Accessible name; icons are decorative (hidden from screen readers) without it. */
  label?: string;
};

/** Lucide icon with the design system defaults: 20px, 1.75 stroke. */
export function Icon({
  icon: Glyph,
  size = 20,
  strokeWidth = 1.75,
  label,
  ...props
}: IconProps) {
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
      {...props}
    />
  );
}
