import { Delete, Space } from "lucide-react";
import type { MouseEvent } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

// Standard ЙЦУКЕН rows plus ё: 33 lowercase letters.
const ROWS = ["йцукенгшщзхъ", "фывапролджэ", "ячсмитьбюё"];

// The bottom edge reads as the key's thickness; pressing moves it down 1px.
const keyClass =
  "flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-control bg-sheet font-medium text-ink select-none " +
  "shadow-[0_1px_0_1px_var(--rule)] transition-[transform,background-color,box-shadow] duration-100 ease-out-soft " +
  "hover:bg-paper active:translate-y-px active:bg-accent active:text-on-accent active:shadow-none " +
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
      className="grid gap-1.5 rounded-card bg-sheet-2 p-1.5 pb-2 shadow-[inset_0_0_0_1px_var(--hairline)] sm:gap-2 sm:p-2.5"
    >
      {ROWS.map((row) => (
        <div key={row} className="flex gap-1 sm:gap-1.5" lang="ru">
          {[...row].map((letter) => (
            <button
              key={letter}
              type="button"
              disabled={disabled}
              onMouseDown={keep}
              onClick={() => onKey(letter)}
              className={cx(keyClass, "text-lg sm:text-xl")}
            >
              {letter}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-1.5 sm:gap-2">
        <button
          type="button"
          disabled={disabled}
          onMouseDown={keep}
          onClick={onSpace}
          className={cx(keyClass, "flex-[3] gap-2 text-sm")}
        >
          <Icon icon={Space} size={18} />
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
          <Icon icon={Delete} />
        </button>
      </div>
    </div>
  );
}
