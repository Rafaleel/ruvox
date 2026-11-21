import { useEffect, useRef, useState } from "react";
import { Check, Timer, X } from "lucide-react";
import type { Question } from "../api/client";
import { cx } from "./cx";
import { Icon } from "./Icon";

export const PAIRS_SECONDS = 60;

const shuffled = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

type Tile = "idle" | "picked" | "matched" | "wrong";

const tileClass = (state: Tile) =>
  cx(
    "relative flex min-h-14 w-full items-center justify-center gap-1.5 rounded-card px-3 py-2 text-center leading-snug font-semibold break-words",
    "transition-[transform,box-shadow,background-color] duration-150 ease-out-soft",
    state === "idle" &&
      "bg-sheet text-ink shadow-card hover:-translate-y-px active:scale-[.97]",
    state === "picked" &&
      "-translate-y-px bg-sheet text-ink shadow-[0_0_0_2px_var(--accent),0_6px_14px_-8px_rgba(27,36,51,.3)]",
    state === "matched" &&
      "bg-success-soft text-success shadow-[0_0_0_1px_var(--success)]",
    state === "wrong" &&
      "shake bg-danger-soft text-danger shadow-[0_0_0_1.5px_var(--danger)]",
  );

function TileMark({ state }: { state: Tile }) {
  if (state === "matched")
    return <Icon icon={Check} size={18} className="shrink-0" />;
  if (state === "wrong")
    return <Icon icon={X} size={18} className="shrink-0" />;
  return null;
}

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
  // The last mismatched pair, flagged on both tiles until the next pick.
  const [wrong, setWrong] = useState<{ left: number; right: number } | null>(
    null,
  );
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
      setWrong(null);
      const next = new Set(matched).add(itemId);
      setMatched(next);
      if (next.size === pairs.length) finish(next, mistakes, false);
    } else {
      setWrong({ left: picked, right: itemId });
      setMistakes({ ...mistakes, [picked]: (mistakes[picked] ?? 0) + 1 });
    }
  };

  const mistakeCount = Object.values(mistakes).reduce((a, b) => a + b, 0);
  const urgent = secondsLeft <= 10;
  const tileState = (side: "left" | "right", itemId: number): Tile =>
    matched.has(itemId)
      ? "matched"
      : wrong?.[side] === itemId
        ? "wrong"
        : side === "left" && picked === itemId
          ? "picked"
          : "idle";

  return (
    <div className="mt-4">
      <div className="rounded-card bg-sheet p-3 shadow-card">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-ink">
            {matched.size} de {pairs.length} pares
          </span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-ink-2">
              <Icon icon={X} size={14} />
              Erros: {mistakeCount}
            </span>
            <span
              className={cx(
                "flex items-center gap-1 font-semibold",
                urgent ? "text-danger" : "text-ink-2",
              )}
            >
              <Icon icon={Timer} size={16} />
              Tempo: {Math.max(0, secondsLeft)}s
            </span>
          </span>
        </div>
        <div
          aria-hidden="true"
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-sheet-2"
        >
          <div
            className={cx(
              "h-full origin-left rounded-full transition-transform duration-1000 ease-linear",
              urgent ? "bg-danger" : "bg-accent",
            )}
            style={{
              transform: `scaleX(${Math.max(0, secondsLeft) / PAIRS_SECONDS})`,
            }}
          />
        </div>
      </div>
      {/* Only the 10 second warning is announced, not every tick. */}
      <p aria-live="polite" className="sr-only">
        {secondsLeft === 10 ? "Faltam 10 segundos." : ""}
      </p>
      <p
        aria-live="polite"
        className="mt-3 min-h-6 text-sm font-medium text-danger"
      >
        {wrong ? "Não combina. Tente de novo." : ""}
      </p>
      <div className="mt-1 grid grid-cols-2 gap-3">
        <ul className="grid content-start gap-3" aria-label="Palavras">
          {lefts.map((p) => {
            const state = tileState("left", p.item_id);
            return (
              <li key={p.item_id}>
                <button
                  type="button"
                  lang="ru"
                  disabled={finished || matched.has(p.item_id)}
                  aria-pressed={picked === p.item_id}
                  onClick={() => {
                    setWrong(null);
                    setPicked(p.item_id);
                  }}
                  className={cx(tileClass(state), "font-serif text-xl")}
                >
                  <TileMark state={state} />
                  {p.left}
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="grid content-start gap-3" aria-label="Significados">
          {rights.map((p) => {
            const state = tileState("right", p.item_id);
            return (
              <li key={p.item_id}>
                <button
                  type="button"
                  disabled={finished || matched.has(p.item_id)}
                  onClick={() => pickRight(p.item_id)}
                  className={tileClass(state)}
                >
                  <TileMark state={state} />
                  {p.right}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
