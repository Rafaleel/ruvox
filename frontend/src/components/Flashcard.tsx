import { useState } from "react";
import type { Question } from "../api/client";
import { Button } from "./Button";
import { Card } from "./Card";

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
  return (
    <>
      <Card className="mt-6 text-center">
        <p className="text-5xl font-extrabold break-words" lang="ru">
          {question.prompt}
        </p>
        {(flipped || done) && (
          <p className="mt-4 border-t border-line pt-4 text-xl">
            {question.reveal}
          </p>
        )}
      </Card>
      {!flipped && !done && (
        <Button className="mt-4 w-full" onClick={() => setFlipped(true)}>
          Virar
        </Button>
      )}
      {flipped && !done && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => onAnswer("missed")}
          >
            Errei
          </Button>
          <Button disabled={disabled} onClick={() => onAnswer("knew")}>
            Sabia
          </Button>
        </div>
      )}
    </>
  );
}
