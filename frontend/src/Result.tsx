import { House, RotateCw, Sparkles } from "lucide-react";
import { Link } from "react-router";
import type { FinishResult, Session } from "./api/client";
import { Button, buttonClasses } from "./components/Button";
import { Card } from "./components/Card";
import { Icon } from "./components/Icon";
import { stagger } from "./components/motion";
import { Notice } from "./components/Notice";
import { ProgressRing } from "./components/ProgressRing";
import { SourceBadge } from "./components/SourceBadge";

/** A warm headline that never scolds: it depends on the share of right answers. */
function headline(correct: number, answered: number) {
  const share = answered > 0 ? correct / answered : 0;
  if (share === 1) return "Sessão perfeita!";
  if (share >= 0.7) return "Mandou bem!";
  return "Cada erro ensina. Vamos revisar?";
}

export function Result({
  result,
  source,
  onRestart,
}: {
  result: FinishResult;
  source: Session["source"];
  onRestart: () => void;
}) {
  const perfect = result.answered > 0 && result.correct === result.answered;
  return (
    <>
      <section className="rise margin-rule rounded-hero bg-sheet py-8 pr-6 pl-10 shadow-card md:pl-16">
        <div className="flex items-center gap-2.5">
          <p className="text-sm font-semibold tracking-wide text-accent">
            Resultado
          </p>
          <SourceBadge source={source} />
        </div>
        <div className="mt-5 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <ProgressRing
            value={result.correct}
            total={result.answered}
            label={`${result.correct} de ${result.answered} acertos`}
            size={128}
            strokeWidth={10}
          >
            <span className="font-serif text-4xl font-semibold">
              {result.score}/{result.answered}
            </span>
          </ProgressRing>
          <div>
            <h1 className="flex items-center gap-2 text-h1 md:text-[2.25rem]">
              {headline(result.correct, result.answered)}
              {perfect && (
                <Icon icon={Sparkles} size={26} className="text-gold" />
              )}
            </h1>
            <p className="mt-2 text-ink-2">
              Você acertou {result.correct} de {result.answered} perguntas.
            </p>
          </div>
        </div>
      </section>

      <section className="rise mt-10" style={stagger(1)}>
        <h2 className="mb-4">Para revisar</h2>
        {result.items_to_review.length === 0 ? (
          <Notice tone="success">Nada para revisar. Mandou bem!</Notice>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {result.items_to_review.map((item, i) => (
              <li key={item.id} className="rise" style={stagger(i + 2)}>
                <Card className="h-full p-4">
                  <p
                    lang="ru"
                    className="font-serif text-3xl leading-tight font-semibold break-words text-ink"
                  >
                    {item.text}
                  </p>
                  <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="rounded-control bg-sheet-2 px-2.5 py-0.5 text-sm font-medium text-ink-2">
                      ({item.pronunciation})
                    </span>
                    <span className="leading-snug">{item.meaning}</span>
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div
        className="rise mt-10 flex flex-col gap-3 sm:flex-row"
        style={stagger(3)}
      >
        <Button
          size="lg"
          icon={RotateCw}
          className="sm:min-w-56"
          onClick={onRestart}
        >
          Jogar de novo
        </Button>
        <Link to="/" className={buttonClasses("secondary", "lg")}>
          <Icon icon={House} />
          Voltar ao início
        </Link>
      </div>
    </>
  );
}
