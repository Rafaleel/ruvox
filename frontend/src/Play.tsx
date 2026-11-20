import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { createSession, type Session } from "./api/client";
import { Button } from "./components/Button";
import { ErrorMessage } from "./components/ErrorMessage";
import { Quiz } from "./Quiz";

const SIZES = [5, 10, 15];

export function Play() {
  const [session, setSession] = useState<Session | null>(null);
  const [size, setSize] = useState(10);
  const start = useMutation({
    mutationFn: createSession,
    onSuccess: setSession,
  });

  if (session)
    return (
      <Quiz
        key={session.session_id}
        session={session}
        onRestart={() => setSession(null)}
      />
    );

  return (
    <>
      <h1 className="text-3xl font-extrabold">Jogar</h1>
      <p className="mt-2 text-muted">
        Uma sessão mistura letras, sons e palavras.
      </p>
      <fieldset className="mt-6">
        <legend className="mb-2 font-semibold">Quantas perguntas?</legend>
        <div className="flex gap-2">
          {SIZES.map((n) => (
            <label key={n} className="flex-1">
              <input
                type="radio"
                name="size"
                value={n}
                checked={size === n}
                onChange={() => setSize(n)}
                className="peer sr-only"
              />
              <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface font-semibold peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                {n}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button
        className="mt-6 w-full"
        disabled={start.isPending}
        onClick={() => start.mutate({ mode: "mixed", size })}
      >
        {start.isPending ? "Começando…" : "Começar"}
      </Button>
      {start.isError && (
        <div className="mt-4">
          <ErrorMessage
            error={start.error}
            onRetry={() => start.mutate({ mode: "mixed", size })}
          />
        </div>
      )}
    </>
  );
}
