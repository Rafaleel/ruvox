import { Check, RotateCw, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Question } from "../api/client";
import { Button } from "./Button";
import { cx } from "./cx";
import { Icon } from "./Icon";

const verdictButton =
  "inline-flex min-h-16 items-center justify-center gap-2.5 rounded-card px-6 py-2 text-xl font-semibold select-none " +
  "transition-[transform,filter] duration-150 ease-out-soft hover:-translate-y-0.5 active:scale-[.97] " +
  "disabled:pointer-events-none disabled:opacity-50";

/** One face of the card: paper with the margin rule and ruled lines. */
function Face({
  side,
  hidden,
  children,
}: {
  side: "front" | "back";
  hidden?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden={hidden || undefined}
      className={cx(
        "flip-face margin-rule relative grid [grid-area:1/1] place-items-center overflow-hidden rounded-hero bg-sheet py-10 pr-6 pl-12 text-center shadow-card @[34rem]:pl-16",
        side === "front" ? "flip-face-front" : "flip-face-back",
      )}
    >
      <div
        aria-hidden="true"
        className="ruled pointer-events-none absolute inset-0"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Self-graded card: flip to see the answer, then say whether you knew it. */
export function Flashcard({
  question,
  disabled,
  done,
  onAnswer,
}: {
  question: Question;
  disabled: boolean;
  done: boolean;
  onAnswer: (answer: "knew" | "missed") => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const showBack = flipped || done;
  const short = [...question.prompt].length <= 4;
  return (
    <>
      <div className="flip-scene mt-5">
        <div
          data-flipped={showBack}
          className="flip-card grid min-h-[22rem] @[34rem]:min-h-[26rem]"
        >
          <Face side="front" hidden={showBack}>
            <p className="text-sm font-semibold tracking-wide text-accent uppercase">
              Cartão
            </p>
            <p
              lang="ru"
              className={cx(
                "mt-3 font-serif leading-[1.1] font-semibold tracking-tight break-words text-ink",
                short
                  ? "text-[clamp(6rem,14cqw,9rem)]"
                  : "text-[clamp(2.75rem,8cqw,5rem)]",
              )}
            >
              {question.prompt}
            </p>
            <p className="mt-5 text-ink-3">
              Lembra o que significa? Vire para conferir.
            </p>
          </Face>
          {showBack && (
            <Face side="back">
              <p className="text-sm font-semibold tracking-wide text-accent uppercase">
                Significado
              </p>
              <p
                lang="ru"
                aria-hidden="true"
                className="mt-2 font-serif text-3xl leading-none text-ink-3"
              >
                {question.prompt}
              </p>
              <p className="mt-6 font-serif text-[clamp(2.25rem,7cqw,3.5rem)] leading-tight font-semibold text-balance text-ink">
                {question.reveal}
              </p>
            </Face>
          )}
        </div>
      </div>
      {!showBack && (
        <Button
          size="lg"
          icon={RotateCw}
          className="mx-auto mt-5 flex w-full @[34rem]:w-80"
          onClick={() => setFlipped(true)}
        >
          Virar
        </Button>
      )}
      {flipped && !done && (
        <div className="rise mx-auto mt-5 grid max-w-xl grid-cols-2 gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAnswer("missed")}
            className={cx(
              verdictButton,
              "bg-danger-soft text-danger shadow-[inset_0_0_0_2px_var(--danger)]",
            )}
          >
            <Icon icon={X} size={24} strokeWidth={2.25} />
            Errei
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAnswer("knew")}
            className={cx(
              verdictButton,
              "bg-success-soft text-success shadow-[inset_0_0_0_2px_var(--success)]",
            )}
          >
            <Icon icon={Check} size={24} strokeWidth={2.25} />
            Sabia
          </button>
        </div>
      )}
    </>
  );
}
