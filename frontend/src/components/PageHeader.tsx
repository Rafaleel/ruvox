import type { ReactNode } from "react";
import { cx } from "./cx";

/** Top of every screen: the title is always an h1. */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cx(
        "flex flex-wrap items-end justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-sm font-semibold tracking-wide text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="text-h1 md:text-[2.25rem]">{title}</h1>
        {description && (
          <p className="mt-2 max-w-prose text-ink-2">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}
