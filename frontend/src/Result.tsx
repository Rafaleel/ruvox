import type { FinishResult } from "./api/client";
import { Button } from "./components/Button";
import { Card } from "./components/Card";

export function Result({
  result,
  onRestart,
}: {
  result: FinishResult;
  onRestart: () => void;
}) {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Resultado</h1>
      <Card className="mt-4 text-center">
        <p className="text-5xl font-extrabold">
          {result.score}/{result.answered}
        </p>
        <p className="mt-1 text-muted">
          Você acertou {result.correct} de {result.answered} perguntas.
        </p>
      </Card>
      <h2 className="mt-6 text-xl font-bold">Para revisar</h2>
      {result.items_to_review.length === 0 ? (
        <p className="mt-2 text-muted">Nada para revisar. Mandou bem!</p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {result.items_to_review.map((item) => (
            <li key={item.id}>
              <Card>
                <span lang="ru" className="text-2xl font-bold">
                  {item.text}
                </span>
                <span className="ml-2 text-muted">({item.pronunciation})</span>
                <p>{item.meaning}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Button className="mt-6 w-full" onClick={onRestart}>
        Jogar de novo
      </Button>
    </>
  );
}
