import type { MouseEvent } from "react";

// Standard ЙЦУКЕН rows plus ё: 33 lowercase letters.
const ROWS = ["йцукенгшщзхъ", "фывапролджэ", "ячсмитьбюё"];

const keyClass =
  "flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-lg border border-line bg-surface text-lg font-semibold select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-accent active:text-on-accent disabled:opacity-50";

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
    <div role="group" aria-label="Teclado cirílico" className="grid gap-1.5">
      {ROWS.map((row) => (
        <div key={row} className="flex gap-1.5" lang="ru">
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
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onMouseDown={keep}
          onClick={onSpace}
          className={`${keyClass} flex-[3] text-base`}
        >
          espaço
        </button>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={keep}
          onClick={onBackspace}
          className={`${keyClass} flex-[2] text-base`}
        >
          apagar
        </button>
      </div>
    </div>
  );
}
