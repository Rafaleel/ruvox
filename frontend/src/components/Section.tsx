import { useId, type ReactNode } from "react";
import { cx } from "./cx";

/** A titled group of cards on a screen: serif h2, optional intro, then the content. */
export function Section({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cx("grid gap-4", className)}>
      <div>
        <h2 id={id} className="text-h2">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-prose text-ink-2">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
