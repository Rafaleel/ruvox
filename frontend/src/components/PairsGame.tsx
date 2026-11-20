import { useEffect, useRef, useState } from "react";
import type { Question } from "../api/client";

export const PAIRS_SECONDS = 60;

const shuffled = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const cellClass = (state: "idle" | "picked" | "matched") =>
  `min-h-14 w-full rounded-xl border-2 px-3 py-2 text-base font-semibold break-words focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
    state === "matched"
      ? "border-success bg-surface opacity-60"
      : state === "picked"
        ? "border-accent bg-surface"
        : "border-line bg-surface"
  }`;

/**
 * Match words with meanings before the clock runs out. Reports the mistakes
 * per item as a JSON string once everything is matched or time is up.
 */
export function PairsGame({
  pairs,
  onSubmit,
}: {
  pairs: NonNullable<Question["pairs"]>;
  onSubmit: (answer: string) => void;
}) {
  const [lefts] = useState(() => shuffled(pairs));
  const [rights] = useState(() => shuffled(pairs));
  const [picked, setPicked] = useState<number | null>(null);
  const [matched, setMatched] = useState<ReadonlySet<number>>(new Set());
  const [mistakes, setMistakes] = useState<Record<number, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(PAIRS_SECONDS);
  const [finished, setFinished] = useState(false);
  const [wrong, setWrong] = useState(false);
  const sent = useRef(false);

  const finish = (
    done: ReadonlySet<number>,
    errors: Record<number, number>,
    timedOut: boolean,
  ) => {
    if (sent.current) return;
    sent.current = true;
    setFinished(true);
    onSubmit(
      JSON.stringify(
        Object.fromEntries(
          pairs.map((p) => [
            p.item_id,
            (errors[p.item_id] ?? 0) +
              (timedOut && !done.has(p.item_id) ? 1 : 0),
          ]),
        ),
      ),
    );
  };

  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [finished]);

  // The handler is re-created each render, so it sees the latest state.
  useEffect(() => {
    if (secondsLeft <= 0) finish(matched, mistakes, true);
  });

  const pickRight = (itemId: number) => {
    if (picked === null || finished) return;
    setPicked(null);
    if (picked === itemId) {
      setWrong(false);
      const next = new Set(matched).add(itemId);
      setMatched(next);
      if (next.size === pairs.length) finish(next, mistakes, false);
    } else {
      setWrong(true);
      setMistakes({ ...mistakes, [picked]: (mistakes[picked] ?? 0) + 1 });
    }
  };

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between text-sm text-muted">
        <span>
          {matched.size} de {pairs.length} pares
        </span>
        <span className={secondsLeft <= 10 ? "font-bold text-danger" : ""}>
          Tempo: {Math.max(0, secondsLeft)}s
        </span>
      </div>
      {/* Only the 10 second warning is announced, not every tick. */}
      <p aria-live="polite" className="sr-only">
        {secondsLeft === 10 ? "Faltam 10 segundos." : ""}
      </p>
      <p aria-live="polite" className="mt-2 min-h-6 text-sm text-danger">
        {wrong ? "Não combina. Tente de novo." : ""}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <ul className="grid content-start gap-3" aria-label="Palavras">
          {lefts.map((p) => (
            <li key={p.item_id}>
              <button
                type="button"
                lang="ru"
                disabled={finished || matched.has(p.item_id)}
                aria-pressed={picked === p.item_id}
                onClick={() => {
                  setWrong(false);
                  setPicked(p.item_id);
                }}
                className={cellClass(
                  matched.has(p.item_id)
                    ? "matched"
                    : picked === p.item_id
                      ? "picked"
                      : "idle",
                )}
              >
                {p.left}
              </button>
            </li>
          ))}
        </ul>
        <ul className="grid content-start gap-3" aria-label="Significados">
          {rights.map((p) => (
            <li key={p.item_id}>
              <button
                type="button"
                disabled={finished || matched.has(p.item_id)}
                onClick={() => pickRight(p.item_id)}
                className={cellClass(
                  matched.has(p.item_id) ? "matched" : "idle",
                )}
              >
                {p.right}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
