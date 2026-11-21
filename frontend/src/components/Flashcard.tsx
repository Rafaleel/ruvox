import { Check, RotateCw, X } from "lucide-react";
import { useState } from "react";
import type { Question } from "../api/client";
import { Button } from "./Button";
import { cx } from "./cx";
import { Icon } from "./Icon";

const softButton =
  "inline-flex min-h-13 items-center justify-center gap-2 rounded-control px-6 py-2 text-lg font-semibold select-none " +
  "transition-[transform,filter] duration-150 ease-out-soft active:scale-[.97] hover:brightness-95 " +
  "disabled:pointer-events-none disabled:opacity-50";

const face =
  "margin-rule grid [grid-area:1/1] place-items-center rounded-hero bg-sheet py-8 pr-6 pl-12 text-center shadow-card backface-hidden";

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
  return (
    <>
      <div className="mt-6 [perspective:1200px]">
        <div
          className={cx(
            "grid min-h-72 transform-3d transition-transform duration-300 ease-out-soft",
            showBack && "rotate-y-180",
          )}
        >
          <div className={face}>
            <div>
              <p
                lang="ru"
                className={cx(
                  "font-serif leading-none font-semibold break-words text-ink",
                  [...question.prompt].length <= 4
                    ? "text-letter-hero"
                    : "text-[2.75rem] sm:text-[3.5rem]",
                )}
              >
                {question.prompt}
              </p>
              <p className="mt-6 text-sm text-ink-3">
                Lembra o que significa? Vire para conferir.
              </p>
            </div>
          </div>
          {showBack && (
            <div className={cx(face, "rotate-y-180")}>
              <div>
                <p
                  lang="ru"
                  aria-hidden="true"
                  className="font-serif text-2xl leading-none text-ink-3"
                >
                  {question.prompt}
                </p>
                <p className="mt-5 text-2xl leading-snug font-semibold text-ink">
                  {question.reveal}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      {!showBack && (
        <Button
          size="lg"
          icon={RotateCw}
          className="mt-4 w-full md:mx-auto md:flex md:w-72"
          onClick={() => setFlipped(true)}
        >
          Virar
        </Button>
      )}
      {flipped && !done && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:mx-auto md:max-w-md">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAnswer("missed")}
            className={cx(
              softButton,
              "bg-danger-soft text-danger shadow-[inset_0_0_0_1px_var(--danger)]",
            )}
          >
            <Icon icon={X} />
            Errei
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAnswer("knew")}
            className={cx(
              softButton,
              "bg-success-soft text-success shadow-[inset_0_0_0_1px_var(--success)]",
            )}
          >
            <Icon icon={Check} />
            Sabia
          </button>
        </div>
      )}
    </>
  );
}
