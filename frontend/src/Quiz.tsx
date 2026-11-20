import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  finishSession,
  sendAnswer,
  type AnswerResult,
  type Session,
} from "./api/client";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { ErrorMessage } from "./components/ErrorMessage";
import { ProgressBar } from "./components/ProgressBar";
import { Result } from "./Result";

type Feedback = { chosen: string; result: AnswerResult };

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
    return <Result result={finish.data} onRestart={onRestart} />;
  if (finish.isPending) return <p role="status">Calculando o resultado…</p>;
  if (finish.isError)
    return (
      <ErrorMessage error={finish.error} onRetry={() => finish.mutate()} />
    );

  const result = feedback?.result;
  return (
    <>
      <div className="flex items-baseline justify-between text-sm text-muted">
        <span>
          Pergunta {index + 1} de {queue.length}
        </span>
        <span>Acertos: {score}</span>
      </div>
      <div className="mt-2">
        <ProgressBar
          value={index + (feedback ? 1 : 0)}
          max={queue.length}
          label="Progresso da sessão"
        />
      </div>
      <Card className="mt-6">
        <h1 className="text-2xl font-bold">{question.prompt}</h1>
      </Card>
      <ul className="mt-4 grid gap-3">
        {question.options.map((option, i) => {
          const state = !feedback
            ? "border-line"
            : option === feedback.result.correct_answer
              ? "border-success"
              : option === feedback.chosen
                ? "border-danger"
                : "border-line opacity-60";
          return (
            <li key={option}>
              <button
                type="button"
                disabled={!!result || answer.isPending}
                onClick={() => choose(option)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl border-2 bg-surface px-4 py-3 text-left text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${state}`}
              >
                <span
                  aria-hidden="true"
                  className="hidden text-muted md:inline"
                >
                  {i + 1}
                </span>
                {option}
              </button>
            </li>
          );
        })}
      </ul>
      <div aria-live="polite" className="mt-4">
        {result && (
          <>
            <p
              className={`text-lg font-bold ${result.correct ? "text-success" : "text-danger"}`}
            >
              {result.correct ? "Correto!" : "Errou."}
            </p>
            <p>
              Resposta certa: <strong>{result.correct_answer}</strong>
            </p>
            <p className="mt-1 text-muted">{result.explanation}</p>
          </>
        )}
      </div>
      {result && (
        <Button autoFocus className="mt-4 w-full" onClick={next}>
          Próxima
        </Button>
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
