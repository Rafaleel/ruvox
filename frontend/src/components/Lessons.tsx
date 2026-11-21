import { ArrowRight } from "lucide-react";
import { useState } from "react";
import type { Lesson } from "../api/client";
import { Button } from "./Button";
import { useHideDock } from "./DockProvider";
import { LetterCard } from "./LetterCard";

/** Intro cards shown before a session: each new letter or word gets one calm look before it is asked. */
export function Lessons({
  lessons,
  onDone,
}: {
  lessons: Lesson[];
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  useHideDock(true);
  const lesson = lessons[step];
  const last = step === lessons.length - 1;
  return (
    <div className="mx-auto w-full max-w-[34rem] pt-[min(4vh,3rem)]">
      <header className="flex items-center justify-between gap-3">
        <p className="font-semibold text-ink-2">
          Novidade {step + 1} de {lessons.length}
        </p>
        <Button variant="ghost" onClick={onDone}>
          Pular<span className="sr-only"> as lições</span>
        </Button>
      </header>
      <h1 className="mt-4 text-2xl">Antes de começar</h1>
      <div className="mt-4">
        {lesson.kind === "letter" ? (
          <LetterCard
            letter={lesson.text}
            pronunciation={lesson.pronunciation}
            size="lg"
          />
        ) : (
          <div className="rounded-card bg-sheet p-6 text-center shadow-card">
            <p lang="ru" className="font-serif text-6xl font-semibold">
              {lesson.text}
            </p>
            <p className="mt-3 text-lg text-ink-2">({lesson.pronunciation})</p>
            <p className="mt-2 text-xl font-semibold">{lesson.meaning}</p>
          </div>
        )}
      </div>
      {lesson.note && <p className="mt-4 text-ink-2">{lesson.note}</p>}
      <div className="mt-6 flex justify-end">
        <Button
          icon={ArrowRight}
          autoFocus
          onClick={() => (last ? onDone() : setStep(step + 1))}
        >
          {last ? "Começar o jogo" : "Próxima"}
        </Button>
      </div>
    </div>
  );
}
