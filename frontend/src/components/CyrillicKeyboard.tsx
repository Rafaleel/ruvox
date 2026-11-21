import { Delete, Space } from "lucide-react";
import type { MouseEvent } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

// Standard ЙЦУКЕН rows plus ё: 33 lowercase letters.
const ROWS = ["йцукенгшщзхъ", "фывапролджэ", "ячсмитьбюё"];

// A keycap: the bottom edge reads as its thickness and pressing sinks it into
// the board. Keys are at least 2.75rem tall; their width flexes with the row
// because twelve keys of 2.75rem do not fit a 480px window.
const keyClass =
  "flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-control bg-sheet font-serif text-xl font-medium text-ink select-none @[34rem]:min-h-12 @[34rem]:text-2xl " +
  "shadow-[0_0.1875rem_0_var(--rule),0_0_0_1px_var(--hairline)] transition-[transform,background-color,box-shadow] duration-100 ease-out-soft " +
  "hover:bg-paper active:translate-y-[0.125rem] active:bg-accent active:text-on-accent active:shadow-[0_0.0625rem_0_var(--rule)] " +
  "disabled:pointer-events-none disabled:opacity-50";

export function CyrillicKeyboard({
  onKey,
  onSpace,
  onBackspace,
  disabled,
}: {
  onKey: (letter: string) => void;
  onSpace: () => void;
  onBackspace: () => void;
  disabled?: boolean;
}) {
  // Keeping focus in the text field lets the physical keyboard keep working.
  const keep = (e: MouseEvent) => e.preventDefault();
  return (
    <div
      role="group"
      aria-label="Teclado cirílico"
      className="grid gap-1.5 rounded-card bg-sheet-2 p-1.5 pb-2.5 shadow-[inset_0_0_0_1px_var(--hairline)] @[34rem]:gap-2 @[34rem]:p-3 @[34rem]:pb-3.5"
    >
      {ROWS.map((row) => (
        <div key={row} className="flex gap-1 @[34rem]:gap-1.5" lang="ru">
          {[...row].map((letter) => (
            <button
              key={letter}
              type="button"
              disabled={disabled}
              onMouseDown={keep}
              onClick={() => onKey(letter)}
              className={keyClass}
            >
              {letter}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-1.5 @[34rem]:gap-2">
        <button
          type="button"
          disabled={disabled}
          onMouseDown={keep}
          onClick={onSpace}
          className={cx(
            keyClass,
            "flex-[3] gap-2 font-sans text-sm @[34rem]:text-base",
          )}
        >
          <Icon icon={Space} size={20} />
          espaço
        </button>
        <button
          type="button"
          aria-label="apagar"
          disabled={disabled}
          onMouseDown={keep}
          onClick={onBackspace}
          className={cx(keyClass, "flex-[2]")}
        >
          <Icon icon={Delete} size={22} />
        </button>
      </div>
    </div>
  );
}
