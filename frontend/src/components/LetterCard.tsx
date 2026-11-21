import { cx } from "./cx";
import { MASTERY_META, StatusPip, type Mastery } from "./letterStatus";

/**
 * The signature object: a big serif Cyrillic letter with its pt-BR
 * pronunciation tag. With `status` it also shows how well the letter is known,
 * as a shape and a word (never color alone). `id` makes it a link target.
 */
export function LetterCard({
  letter,
  pronunciation,
  size = "md",
  status,
  id,
  highlighted = false,
  className,
}: {
  /** Upper case letter; the lower case is derived. */
  letter: string;
  pronunciation: string;
  size?: "md" | "lg";
  status?: Mastery;
  id?: string;
  /** Ringed in the accent, for the letter a link pointed at. */
  highlighted?: boolean;
  className?: string;
}) {
  const meta = status ? MASTERY_META[status] : null;
  return (
    <div
      id={id}
      tabIndex={id ? -1 : undefined}
      className={cx(
        "@container relative flex outline-none scroll-mt-6 flex-col items-center gap-3 overflow-hidden rounded-card bg-sheet px-3 pt-4 pb-4 text-center shadow-card",
        highlighted && "ring-2 ring-accent",
        className,
      )}
    >
      <p
        className={cx(
          "relative -mb-1 flex min-h-[1.5rem] w-full items-center justify-end",
        )}
      >
        {meta && status ? (
          <span
            className={cx(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
              meta.tile,
            )}
          >
            <StatusPip status={status} className={meta.pip} />
            {meta.label}
          </span>
        ) : null}
      </p>
      <p
        lang="ru"
        className={cx(
          "relative font-serif leading-none font-semibold whitespace-nowrap text-ink",
          size === "lg"
            ? "text-letter-hero"
            : "text-[clamp(2.75rem,34cqw,4rem)]",
        )}
      >
        <span>{letter}</span>{" "}
        <span className="font-normal text-ink-2">{letter.toLowerCase()}</span>
      </p>
      <p className="relative rounded-control bg-sheet-2 px-2.5 py-1 text-sm leading-snug font-medium text-ink-2">
        {pronunciation}
      </p>
    </div>
  );
}
