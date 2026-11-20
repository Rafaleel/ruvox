import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

// Shared with router links that must look like buttons.
export function buttonClasses(variant: Variant = "primary") {
  const base =
    "inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-2 font-semibold " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
    "disabled:opacity-50";
  return variant === "primary"
    ? `${base} bg-accent text-on-accent`
    : `${base} border border-line bg-surface text-ink`;
}

export function Button({
  variant,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`${buttonClasses(variant)} ${className}`}
      {...props}
    />
  );
}
