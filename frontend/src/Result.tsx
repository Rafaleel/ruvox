import { House, PartyPopper, RotateCw, Sparkles } from "lucide-react";
import { Link } from "react-router";
import type { FinishResult, Session } from "./api/client";
import { GhostLetter } from "./components/art/GhostLetter";
import { Laurel } from "./components/art/Laurel";
import { StampFrame } from "./components/art/StampFrame";
import { Badge } from "./components/Badge";
import { Button, buttonClasses } from "./components/Button";
import { Icon } from "./components/Icon";
import { stagger } from "./components/motion";
import { SourceBadge } from "./components/SourceBadge";

/** A warm headline that never scolds: it depends on the share of right answers. */
function headline(correct: number, answered: number) {
  const share = answered > 0 ? correct / answered : 0;
  if (share === 1) return "Sessão perfeita!";
  if (share >= 0.7) return "Mandou bem!";
  if (share >= 0.4) return "Está pegando o jeito!";
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
  const share = result.answered > 0 ? result.correct / result.answered : 0;
  const perfect = share === 1;
  const score = (
    <span className="font-serif text-[2.75rem] leading-none font-semibold tracking-tight text-ink">
      {result.score}/{result.answered}
    </span>
  );
  return (
    <div className="grid gap-8 @[52rem]:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] @[52rem]:items-start @[52rem]:gap-10">
      <section className="rise relative overflow-hidden rounded-hero bg-sheet px-6 py-8 text-center shadow-card @[34rem]:px-8 @[34rem]:py-10">
        <div
          aria-hidden="true"
          className="ruled pointer-events-none absolute inset-0"
        />
        <GhostLetter letter="Я" className="-right-8 -bottom-10 w-64" />
        <div className="relative flex items-center justify-center gap-2.5">
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">
            Resultado
          </p>
          <SourceBadge source={source} />
        </div>
        {/* A laurel is earned at 70 percent; below that the score is a plain stamp. */}
        {share >= 0.7 ? (
          <Laurel className="stamp-in relative mx-auto mt-3 w-[min(60%,12.5rem)]">
            {score}
          </Laurel>
        ) : (
          <div className="relative mt-6 flex justify-center">
            <StampFrame
              tilt
              className="stamp-in px-9 py-6 text-center"
              cut="sheet"
            >
              <span className="relative block">{score}</span>
            </StampFrame>
          </div>
        )}
        <h1 className="relative mt-4 flex flex-wrap items-center justify-center gap-2 text-h1 @[34rem]:text-[2.25rem]">
          {headline(result.correct, result.answered)}
          {perfect && <Icon icon={Sparkles} size={28} className="text-gold" />}
        </h1>
        <p className="relative mt-2 text-lg text-ink-2">
          Você acertou {result.correct} de {result.answered} perguntas.
        </p>
        <div className="relative mt-6 grid gap-3">
          <Button size="lg" icon={RotateCw} onClick={onRestart}>
            Jogar de novo
          </Button>
          <Link to="/" className={buttonClasses("secondary", "lg")}>
            <Icon icon={House} />
            Voltar ao início
          </Link>
        </div>
      </section>

      <section className="rise" style={stagger(1)}>
        <h2 className="mb-4 flex items-center gap-3">
          Para revisar
          {result.items_to_review.length > 0 && (
            <Badge tone="accent" className="px-2.5 py-0.5 text-sm">
              {result.items_to_review.length}
            </Badge>
          )}
        </h2>
        {result.items_to_review.length === 0 ? (
          <div className="flex items-center gap-4 rounded-card bg-success-soft p-5 text-success shadow-[inset_0_0_0_1px_var(--success)]">
            <span
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center rounded-full bg-sheet/70"
            >
              <Icon icon={PartyPopper} size={26} />
            </span>
            <p className="text-lg font-semibold">
              Nada para revisar. Mandou bem!
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 @[34rem]:grid-cols-2 @[52rem]:grid-cols-1 @[70rem]:grid-cols-2">
            {result.items_to_review.map((item, i) => (
              <li key={item.id} className="rise" style={stagger(i + 2)}>
                <div className="h-full rounded-card bg-sheet p-4 shadow-card @[34rem]:p-5">
                  <p
                    lang="ru"
                    className="font-serif text-[2.5rem] leading-tight font-semibold tracking-tight break-words text-ink"
                  >
                    {item.text}
                  </p>
                  <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="rounded-control bg-sheet-2 px-2.5 py-0.5 text-sm font-medium text-ink-2">
                      ({item.pronunciation})
                    </span>
                    <span className="leading-snug">{item.meaning}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
