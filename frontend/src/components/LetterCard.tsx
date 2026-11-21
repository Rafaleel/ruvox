import { cx } from "./cx";

/** The signature object: a big serif Cyrillic letter with its pt-BR pronunciation tag. */
export function LetterCard({
  letter,
  pronunciation,
  size = "md",
  className,
}: {
  /** Upper case letter; the lower case is derived. */
  letter: string;
  pronunciation: string;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-3 rounded-card bg-sheet px-3 pt-5 pb-4 text-center shadow-card",
        className,
      )}
    >
      <p
        lang="ru"
        className={cx(
          "font-serif leading-none font-semibold whitespace-nowrap text-ink",
          size === "lg" ? "text-letter-hero" : "text-[3.5rem]",
        )}
      >
        <span>{letter}</span>{" "}
        <span className="font-normal text-ink-2">{letter.toLowerCase()}</span>
      </p>
      <p className="rounded-control bg-sheet-2 px-2.5 py-1 text-sm leading-snug font-medium text-ink-2">
        {pronunciation}
      </p>
    </div>
  );
}
