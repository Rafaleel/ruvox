import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import {
  createSession,
  getSong,
  type Session,
  type SessionCreate,
} from "./api/client";
import { Button } from "./components/Button";
import { ErrorMessage } from "./components/ErrorMessage";
import { Quiz } from "./Quiz";

const SIZES = [5, 10, 15];
const MODES: { label: string; mode: SessionCreate["mode"] }[] = [
  { label: "Misto", mode: "mixed" },
  { label: "Digitação", mode: 4 },
  { label: "Cartões", mode: 5 },
  { label: "Pares", mode: 6 },
  { label: "Lacuna", mode: 7 },
];

function Pill({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="min-w-24 flex-1">
      <input
        type="radio"
        name={name}
        value={label}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface font-semibold peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
        {label}
      </span>
    </label>
  );
}

export function Play() {
  const [session, setSession] = useState<Session | null>(null);
  const [size, setSize] = useState(10);
  const [mode, setMode] = useState<SessionCreate["mode"]>("mixed");
  const [params, setParams] = useSearchParams();
  const songParam = Number(params.get("song"));
  const songId =
    Number.isInteger(songParam) && songParam > 0 ? songParam : null;
  const song = useQuery({
    queryKey: ["song", songId],
    queryFn: ({ signal }) => getSong(songId!, signal),
    enabled: songId !== null,
    retry: false,
  });
  const request: SessionCreate = {
    mode,
    size,
    ...(songId !== null && { song_id: songId }),
  };
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
      {songId !== null && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-line p-3">
          <p>
            Treinando:{" "}
            <strong lang="ru">
              {song.data?.title ??
                (song.isError ? "música não encontrada" : "…")}
            </strong>
          </p>
          <Button variant="secondary" onClick={() => setParams({})}>
            Limpar
          </Button>
        </div>
      )}
      <fieldset className="mt-6">
        <legend className="mb-2 font-semibold">Tipo de treino</legend>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <Pill
              key={m.label}
              name="mode"
              label={m.label}
              checked={mode === m.mode}
              onChange={() => setMode(m.mode)}
            />
          ))}
        </div>
        {mode === 7 && (
          <p className="mt-2 text-sm text-muted">
            Precisa de palavras de músicas salvas.
          </p>
        )}
      </fieldset>
      <fieldset className="mt-6">
        <legend className="mb-2 font-semibold">Quantas perguntas?</legend>
        <div className="flex gap-2">
          {SIZES.map((n) => (
            <Pill
              key={n}
              name="size"
              label={String(n)}
              checked={size === n}
              onChange={() => setSize(n)}
            />
          ))}
        </div>
      </fieldset>
      <Button
        className="mt-6 w-full"
        disabled={start.isPending}
        onClick={() => start.mutate(request)}
      >
        {start.isPending ? "Começando…" : "Começar"}
      </Button>
      {start.isError && (
        <div className="mt-4">
          <ErrorMessage
            error={start.error}
            onRetry={() => start.mutate(request)}
          />
        </div>
      )}
    </>
  );
}
