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
import { ConfirmPanel } from "./components/ConfirmPanel";
import { cx } from "./components/cx";
import { CyrillicKeyboard } from "./components/CyrillicKeyboard";
import { useHideDock } from "./components/DockProvider";
import { ErrorMessage } from "./components/ErrorMessage";
import { Flashcard } from "./components/Flashcard";
import { Icon } from "./components/Icon";
import { stagger } from "./components/motion";
import { PairsGame } from "./components/PairsGame";
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

/** Hero scale: letters 6 to 9rem, short words 3.5 to 5.5rem, long quotes smaller. */
const heroClass = (text: string) => {
  const length = [...text].length;
  if (length <= 3) return "text-[clamp(6rem,16cqw,9rem)]";
  if (length <= 8) return "text-[clamp(3.5rem,9cqw,5.5rem)]";
  return "text-[clamp(2.25rem,5.5cqw,3.5rem)]";
};

/** The notebook's red-pen verdict in the corner of the question card. */
function Verdict({ correct }: { correct: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "absolute top-4 right-4 z-10 grid size-12 place-items-center rounded-full",
        correct
          ? "stamp-in bg-success-soft text-success"
          : "rise bg-danger-soft text-danger",
      )}
    >
      <Icon icon={correct ? Check : X} size={28} strokeWidth={2.5} />
    </span>
  );
}

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
  const [leaving, setLeaving] = useState(false);
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

  // Focus mode while answering; the dock comes back on the result screen.
  useHideDock(!finish.isSuccess);

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

  // Nothing answered yet means nothing to lose: leave without asking.
  const exit = () => (index > 0 || feedback ? setLeaving(true) : onRestart());
  const stay = () => {
    setLeaving(false);
    requestAnimationFrame(() =>
      document.getElementById("session-exit")?.focus(),
    );
  };

  // Re-registered every render so the handler always sees the current state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.repeat ||
        leaving ||
        !finish.isIdle
      )
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
        className="flex items-center justify-center gap-2.5 py-24 text-lg text-ink-2"
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
  const done = index + (feedback ? 1 : 0);
  return (
    <div className="mx-auto w-full max-w-[52rem] pt-[min(4vh,3rem)]">
      <header className="flex items-center gap-3 @[34rem]:gap-4">
        <Button
          id="session-exit"
          variant="ghost"
          icon={X}
          className="-ml-2 shrink-0 px-2.5"
          onClick={exit}
        >
          Sair<span className="sr-only"> da sessão</span>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink-2">
            <span>
              Pergunta {index + 1} de {queue.length}
            </span>
            <SourceBadge source={session.source} />
          </div>
          <div
            role="progressbar"
            aria-label="Progresso da sessão"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={queue.length}
            className="h-2 w-full overflow-hidden rounded-full bg-sheet-2 shadow-[inset_0_0_0_1px_var(--hairline)]"
          >
            <div
              className="h-full origin-left rounded-full bg-accent transition-transform duration-300 ease-out-soft"
              style={{
                transform: `scaleX(${queue.length ? Math.min(1, done / queue.length) : 0})`,
              }}
            />
          </div>
        </div>
        <Badge
          tone="gold"
          icon={Check}
          className="shrink-0 px-3 py-1.5 text-sm"
        >
          Acertos: {score}
        </Badge>
      </header>

      {leaving && (
        <ConfirmPanel
          title="Sair da sessão?"
          confirmLabel="Sair"
          onConfirm={onRestart}
          onCancel={stay}
        >
          <p className="text-ink-2">
            As respostas que você já deu ficam salvas, mas esta sessão não conta
            para a sua sequência.
          </p>
        </ConfirmPanel>
      )}

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
          className={cx(
            "rise relative mt-5 overflow-hidden rounded-hero py-7 pr-6 pl-12 text-center @[34rem]:pl-16",
            hero ? "@[34rem]:py-10" : "@[34rem]:py-9",
          )}
        >
          <div
            aria-hidden="true"
            className="ruled pointer-events-none absolute inset-0"
          />
          {result && <Verdict correct={result.correct} />}
          <h1
            className={cx(
              "relative",
              hero
                ? "font-sans text-lg font-medium text-ink-2"
                : "text-h2 @[34rem]:text-h1 @[44rem]:text-[2.25rem]",
              !hero && question.prompt.length > 40 && "@[34rem]:text-h2",
            )}
          >
            {question.prompt}
          </h1>
          {hero && (
            <p
              lang="ru"
              aria-hidden="true"
              className={cx(
                "relative mt-2 font-serif leading-[1.1] font-semibold tracking-tight break-words text-ink",
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
          className="rise mt-4 grid gap-3"
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
                "min-h-[4.5rem] w-full rounded-card border-2 bg-sheet-2 px-5 font-serif text-[2rem] font-semibold text-ink transition-colors",
                !result
                  ? "border-rule focus:border-accent"
                  : result.correct
                    ? "border-success bg-success-soft pr-14"
                    : "border-danger bg-danger-soft pr-14",
              )}
            />
            {result && (
              <Icon
                icon={result.correct ? CircleCheck : CircleX}
                size={28}
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
        <ul
          key={`options-${index}`}
          className={cx(
            "mt-4 grid gap-3",
            // Short options sit two by two even on a narrow window.
            question.options.every((o) => o.length <= 12)
              ? "grid-cols-2"
              : "@[34rem]:grid-cols-2",
          )}
        >
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
                    "group flex min-h-[4.5rem] w-full items-center gap-3.5 rounded-card px-3.5 py-3 text-left",
                    "transition-[transform,box-shadow,background-color] duration-150 ease-out-soft",
                    !feedback &&
                      "bg-sheet text-ink shadow-card hover:-translate-y-0.5 hover:shadow-[0_0_0_1.5px_var(--rule)] active:scale-[.98] disabled:pointer-events-none",
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
                      "grid size-9 shrink-0 place-items-center rounded-[0.5rem] border text-base font-semibold",
                      right || wrong
                        ? "border-current/40 bg-sheet/60 text-current"
                        : "border-rule/60 bg-paper text-ink-2 shadow-[0_0.1875rem_0_var(--hairline)] group-disabled:shadow-none",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span
                    lang={russian ? "ru" : undefined}
                    className={cx(
                      "min-w-0 flex-1 font-semibold break-words",
                      russian
                        ? "font-serif text-[1.75rem] leading-tight"
                        : "text-lg leading-snug",
                    )}
                  >
                    {option}
                  </span>
                  {right && (
                    <Icon icon={CircleCheck} size={26} className="shrink-0" />
                  )}
                  {wrong && (
                    <Icon icon={CircleX} size={26} className="shrink-0" />
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
      <div
        aria-live="polite"
        className={result ? "mt-5 scroll-mb-4" : undefined}
      >
        {result && (
          <div
            className={cx(
              "rise flex flex-col gap-4 rounded-card p-4 shadow-float ring-2 @[34rem]:flex-row @[34rem]:items-center @[34rem]:gap-5 @[34rem]:p-5",
              result.correct
                ? "bg-success-soft ring-success/50"
                : "bg-danger-soft ring-danger/50",
            )}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3.5">
              <span
                aria-hidden="true"
                className={cx(
                  "grid size-11 shrink-0 place-items-center rounded-full bg-sheet/70",
                  result.correct ? "stamp-in text-success" : "text-danger",
                )}
              >
                <Icon icon={result.correct ? CircleCheck : CircleX} size={28} />
              </span>
              <div className="min-w-0">
                <p
                  className={cx(
                    "font-serif text-2xl leading-tight font-semibold",
                    result.correct ? "text-success" : "text-danger",
                  )}
                >
                  {result.correct ? "Correto!" : "Errou."}
                </p>
                {/* Self-graded and pairs questions have no single correct answer. */}
                {(question.input_kind === "choice" ||
                  question.input_kind === "text") && (
                  <p className="mt-1 text-ink">
                    Resposta certa:{" "}
                    <strong
                      lang={
                        CYRILLIC.test(result.correct_answer) ? "ru" : undefined
                      }
                      className="font-serif text-xl"
                    >
                      {result.correct_answer}
                    </strong>
                  </p>
                )}
                <p className="mt-1 text-ink-2">{result.explanation}</p>
              </div>
            </div>
            <Button
              autoFocus
              size="lg"
              className="w-full shrink-0 @[34rem]:w-auto @[34rem]:min-w-44"
              onClick={next}
            >
              Próxima
              <Icon icon={ArrowRight} />
            </Button>
          </div>
        )}
      </div>
      {answer.isError && (
        <div className="mt-4">
          <ErrorMessage
            error={answer.error}
            onRetry={() => answer.mutate(answer.variables!)}
          />
        </div>
      )}
    </div>
  );
}
