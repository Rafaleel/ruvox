import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  CircleCheck,
  CircleX,
  Loader2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  finishSession,
  sendAnswer,
  type AnswerResult,
  type Session,
} from "./api/client";
import { Badge } from "./components/Badge";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { cx } from "./components/cx";
import { CyrillicKeyboard } from "./components/CyrillicKeyboard";
import { ErrorMessage } from "./components/ErrorMessage";
import { Flashcard } from "./components/Flashcard";
import { Icon } from "./components/Icon";
import { stagger } from "./components/motion";
import { PairsGame } from "./components/PairsGame";
import { ProgressBar } from "./components/ProgressBar";
import { SourceBadge } from "./components/SourceBadge";
import { Result } from "./Result";

type Feedback = { chosen: string; result: AnswerResult };

const CYRILLIC = /[Ѐ-ӿ]/;

/**
 * The Cyrillic text quoted in a prompt such as "Como se lê «Ч»?", shown big as
 * the hero of the card. Blanks (cloze) and long quotes stay in the sentence.
 */
function heroOf(prompt: string): string | null {
  for (const [, quoted] of prompt.matchAll(/«([^»]+)»/g))
    if (CYRILLIC.test(quoted) && !quoted.includes("_") && quoted.length <= 24)
      return quoted;
  return null;
}

/** Hero scale of the design system: letters 72 to 96px, words 44 to 56px. */
const heroClass = (text: string) =>
  [...text].length <= 3
    ? "text-letter sm:text-letter-hero"
    : "text-[2.75rem] sm:text-[3.5rem]";

// On phones the next action floats just above the tab bar.
const stickyBar =
  "sticky bottom-20 z-[5] -mx-5 mt-4 bg-linear-to-t from-paper from-70% to-transparent px-5 pt-6 pb-2 md:static md:mx-0 md:bg-none md:p-0";

export function Quiz({
  session,
  onRestart,
}: {
  session: Session;
  onRestart: () => void;
}) {
  const [queue, setQueue] = useState(session.questions);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [typed, setTyped] = useState("");
  const shownAt = useRef(performance.now());
  const question = queue[index];

  const answer = useMutation({
    mutationFn: (v: { option: string; timeMs: number }) =>
      sendAnswer(session.session_id, {
        question_id: question.id,
        answer: v.option,
        time_ms: v.timeMs,
      }),
    onSuccess: (result, v) => {
      setFeedback({ chosen: v.option, result });
      if (result.correct) setScore((s) => s + 1);
      const requeued = result.requeued_question;
      if (requeued) setQueue((q) => [...q, requeued]);
    },
  });
  const finish = useMutation({
    mutationFn: () => finishSession(session.session_id),
  });

  const choose = (option: string) => {
    if (feedback || answer.isPending) return;
    answer.mutate({
      option,
      timeMs: Math.round(performance.now() - shownAt.current),
    });
  };

  const next = () => {
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      setFeedback(null);
      setTyped("");
      answer.reset();
      shownAt.current = performance.now();
    } else {
      finish.mutate();
    }
  };

  // Re-registered every render so the handler always sees the current state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || !finish.isIdle)
        return;
      if (!feedback) {
        // Digits only pick options; flip, pairs and text answers use their own inputs.
        if (question.input_kind !== "choice") return;
        const option = /^[1-9]$/.test(e.key)
          ? question.options[Number(e.key) - 1]
          : undefined;
        if (option) choose(option);
      } else if (
        (e.key === "Enter" || e.key === " ") &&
        // A focused button already handles Enter/Space itself.
        !(e.target instanceof HTMLButtonElement)
      ) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (finish.isSuccess)
    return (
      <Result
        result={finish.data}
        source={session.source}
        onRestart={onRestart}
      />
    );
  if (finish.isPending)
    return (
      <p
        role="status"
        className="flex items-center justify-center gap-2.5 py-24 text-ink-2"
      >
        <Icon icon={Loader2} className="animate-spin" />
        Calculando o resultado…
      </p>
    );
  if (finish.isError)
    return (
      <ErrorMessage error={finish.error} onRetry={() => finish.mutate()} />
    );

  const result = feedback?.result;
  const hero = question.input_kind === "flip" ? null : heroOf(question.prompt);
  return (
    <>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-semibold text-ink-2">
          Pergunta {index + 1} de {queue.length}
          <SourceBadge source={session.source} />
        </span>
        <Badge tone="gold" icon={Check} className="px-3 py-1 text-sm">
          Acertos: {score}
        </Badge>
      </div>
      <div className="mt-3">
        <ProgressBar
          value={index + (feedback ? 1 : 0)}
          max={queue.length}
          label="Progresso da sessão"
        />
      </div>
      {question.input_kind === "flip" ? (
        <Flashcard
          key={index}
          question={question}
          disabled={answer.isPending}
          done={!!result}
          onAnswer={choose}
        />
      ) : (
        <Card
          key={`prompt-${index}`}
          margin
          className="rise mt-6 rounded-hero py-7 pr-6 md:py-9"
        >
          <h1
            className={cx(
              hero
                ? "font-sans text-base font-medium text-ink-2"
                : "text-h1 text-ink md:text-[2.25rem]",
              !hero && question.prompt.length > 60 && "text-h3 md:text-h2",
            )}
          >
            {question.prompt}
          </h1>
          {hero && (
            <p
              lang="ru"
              aria-hidden="true"
              className={cx(
                "mt-3 font-serif leading-tight font-semibold break-words text-ink",
                heroClass(hero),
              )}
            >
              {hero}
            </p>
          )}
        </Card>
      )}
      {question.input_kind === "pairs" && (
        <PairsGame key={index} pairs={question.pairs ?? []} onSubmit={choose} />
      )}
      {question.input_kind === "text" && (
        <form
          key={index}
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) choose(typed.trim());
          }}
        >
          <div className="relative">
            <input
              type="text"
              aria-label="Sua resposta em russo"
              lang="ru"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              readOnly={!!result || answer.isPending}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className={cx(
                "min-h-16 w-full rounded-card border-2 bg-sheet-2 px-4 font-serif text-3xl font-semibold text-ink transition-colors",
                !result
                  ? "border-rule focus-visible:border-accent"
                  : result.correct
                    ? "border-success bg-success-soft pr-12"
                    : "border-danger bg-danger-soft pr-12",
              )}
            />
            {result && (
              <Icon
                icon={result.correct ? CircleCheck : CircleX}
                size={24}
                className={cx(
                  "absolute top-1/2 right-4 -translate-y-1/2",
                  result.correct ? "text-success" : "text-danger",
                )}
              />
            )}
          </div>
          <CyrillicKeyboard
            disabled={!!result || answer.isPending}
            onKey={(letter) => setTyped((t) => t + letter)}
            onSpace={() => setTyped((t) => t + " ")}
            onBackspace={() => setTyped((t) => t.slice(0, -1))}
          />
          {!result && (
            <Button
              size="lg"
              type="submit"
              loading={answer.isPending}
              disabled={!typed.trim()}
            >
              Responder
            </Button>
          )}
        </form>
      )}
      {question.input_kind === "choice" && (
        <ul key={`options-${index}`} className="mt-4 grid gap-3">
          {question.options.map((option, i) => {
            const right =
              !!feedback && option === feedback.result.correct_answer;
            const wrong = !!feedback && !right && option === feedback.chosen;
            const pending =
              answer.isPending && answer.variables?.option === option;
            const russian = CYRILLIC.test(option);
            return (
              <li key={option} className="rise" style={stagger(i + 1)}>
                <button
                  type="button"
                  disabled={!!result || answer.isPending}
                  onClick={() => choose(option)}
                  className={cx(
                    "group flex min-h-14 w-full items-center gap-3 rounded-card px-3 py-2.5 text-left",
                    "transition-[transform,box-shadow,background-color] duration-150 ease-out-soft",
                    !feedback &&
                      "bg-sheet text-ink shadow-card hover:-translate-y-px hover:shadow-[0_0_0_1px_var(--rule),0_6px_16px_-8px_rgba(27,36,51,.18)] active:scale-[.98] disabled:pointer-events-none",
                    right &&
                      cx(
                        "bg-success-soft text-success shadow-[0_0_0_2px_var(--success)]",
                        feedback.chosen === option && "pulse-ok",
                      ),
                    wrong &&
                      "shake bg-danger-soft text-danger shadow-[0_0_0_2px_var(--danger)]",
                    !!feedback &&
                      !right &&
                      !wrong &&
                      "bg-sheet-2 text-ink-3 shadow-none",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      "grid size-8 shrink-0 place-items-center rounded-control text-sm font-semibold",
                      right || wrong
                        ? "bg-sheet/70 text-current"
                        : "bg-sheet-2 text-ink-2 group-disabled:bg-sheet",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span
                    lang={russian ? "ru" : undefined}
                    className={cx(
                      "min-w-0 flex-1 font-semibold break-words",
                      russian ? "font-serif text-2xl" : "text-lg",
                    )}
                  >
                    {option}
                  </span>
                  {right && (
                    <Icon icon={CircleCheck} size={24} className="shrink-0" />
                  )}
                  {wrong && (
                    <Icon icon={CircleX} size={24} className="shrink-0" />
                  )}
                  {pending && (
                    <Icon
                      icon={Loader2}
                      className="shrink-0 animate-spin text-ink-3"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div aria-live="polite" className={result ? "mt-4" : undefined}>
        {result && (
          <div
            className={cx(
              "rise rounded-card p-4",
              result.correct ? "bg-success-soft" : "bg-danger-soft",
            )}
          >
            <p
              className={cx(
                "flex items-center gap-2 text-lg font-bold",
                result.correct ? "text-success" : "text-danger",
              )}
            >
              <Icon icon={result.correct ? CircleCheck : X} size={22} />
              {result.correct ? "Correto!" : "Errou."}
            </p>
            {/* Self-graded and pairs questions have no single correct answer. */}
            {(question.input_kind === "choice" ||
              question.input_kind === "text") && (
              <p className="mt-1 text-ink">
                Resposta certa:{" "}
                <strong
                  lang={CYRILLIC.test(result.correct_answer) ? "ru" : undefined}
                  className="text-lg"
                >
                  {result.correct_answer}
                </strong>
              </p>
            )}
            <p className="mt-1 text-ink-2">{result.explanation}</p>
          </div>
        )}
      </div>
      {result && (
        <div className={stickyBar}>
          <Button autoFocus size="lg" className="w-full" onClick={next}>
            Próxima
            <Icon icon={ArrowRight} />
          </Button>
        </div>
      )}
      {answer.isError && (
        <div className="mt-4">
          <ErrorMessage
            error={answer.error}
            onRetry={() => answer.mutate(answer.variables!)}
          />
        </div>
      )}
    </>
  );
}
