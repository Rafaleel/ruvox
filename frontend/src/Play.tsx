import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Check,
  Keyboard,
  Layers,
  Link2,
  Music2,
  Play as PlayIcon,
  Shuffle,
  TextCursorInput,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import {
  createSession,
  getSong,
  type Session,
  type SessionCreate,
} from "./api/client";
import { Badge } from "./components/Badge";
import { Button } from "./components/Button";
import { cx } from "./components/cx";
import { ErrorMessage } from "./components/ErrorMessage";
import { Icon } from "./components/Icon";
import { stagger } from "./components/motion";
import { PageHeader } from "./components/PageHeader";
import { Segmented } from "./components/Segmented";
import { Quiz } from "./Quiz";

const SIZES = [5, 10, 15];
const MODES: {
  label: string;
  mode: SessionCreate["mode"];
  icon: LucideIcon;
  description: string;
  hint?: string;
}[] = [
  {
    label: "Misto",
    mode: "mixed",
    icon: Shuffle,
    description: "Um pouco de tudo: letras, sons e palavras na mesma sessão.",
  },
  {
    label: "Digitação",
    mode: 4,
    icon: Keyboard,
    description: "Escreva a resposta em russo com o teclado cirílico.",
  },
  {
    label: "Cartões",
    mode: 5,
    icon: Layers,
    description: "Vire o cartão e diga se você sabia.",
  },
  {
    label: "Pares",
    mode: 6,
    icon: Link2,
    description: "Una cada palavra ao seu significado contra o relógio.",
  },
  {
    label: "Lacuna",
    mode: 7,
    icon: TextCursorInput,
    description: "Complete o trecho de uma música com a palavra que falta.",
    hint: "Precisa de palavras de músicas salvas.",
  },
];

function ModeCard({
  name,
  label,
  icon,
  description,
  hint,
  wide,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  icon: LucideIcon;
  description: string;
  hint?: string;
  wide?: boolean;
  checked: boolean;
  onChange: () => void;
}) {
  const id = `mode-${label}`;
  return (
    <label
      className={cx(
        "relative flex cursor-pointer items-start gap-4 rounded-card bg-sheet p-4 shadow-card",
        "transition-[transform,box-shadow] duration-150 ease-out-soft hover:-translate-y-px active:scale-[.98]",
        "has-checked:shadow-[0_0_0_2px_var(--accent)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent",
        wide && "sm:col-span-2",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="grid size-12 shrink-0 place-items-center rounded-control bg-sheet-2 text-ink-2 transition-colors peer-checked:bg-accent peer-checked:text-on-accent"
      >
        <Icon icon={icon} size={24} />
      </span>
      <span className="min-w-0 flex-1 pr-8">
        <span className="flex items-center gap-2">
          <span id={`${id}-title`} className="font-semibold">
            {label}
          </span>
          {wide && <Badge tone="gold">Recomendado</Badge>}
        </span>
        <span id={`${id}-desc`} className="block text-sm text-ink-2">
          {description}
          {hint && (
            <>
              {" "}
              <span className="mt-1 flex items-start gap-1 font-medium text-gold-ink">
                <Icon icon={Music2} size={14} className="mt-1 shrink-0" />
                {hint}
              </span>
            </>
          )}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="absolute top-4 right-4 grid size-6 place-items-center rounded-full border border-rule text-transparent transition-colors peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent"
      >
        <Icon icon={Check} size={14} strokeWidth={2.5} />
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
      <PageHeader
        title="Jogar"
        description="Uma sessão curta, no seu ritmo. Escolha como quer treinar."
        className="rise"
      />
      {songId !== null && (
        <div
          className="rise mt-6 flex items-center justify-between gap-3 rounded-card bg-gold-soft p-3 pl-4 text-gold-ink"
          style={stagger(1)}
        >
          <p className="flex min-w-0 items-center gap-2.5">
            <Icon icon={Music2} className="shrink-0" />
            <span className="min-w-0">
              Treinando:{" "}
              <strong lang="ru" className="font-serif text-lg font-semibold">
                {song.data?.title ??
                  (song.isError ? "música não encontrada" : "…")}
              </strong>
            </span>
          </p>
          <Button variant="ghost" icon={X} onClick={() => setParams({})}>
            Limpar
          </Button>
        </div>
      )}
      <section className="rise mt-8" style={stagger(2)}>
        <h2 className="mb-2 font-sans text-base font-semibold">
          Quantas perguntas?
        </h2>
        <Segmented
          label="Quantas perguntas?"
          className="w-full sm:w-80"
          options={SIZES.map((n) => ({ value: String(n), label: String(n) }))}
          value={String(size)}
          onChange={(v) => setSize(Number(v))}
        />
      </section>
      <fieldset className="rise mt-8" style={stagger(3)}>
        <legend className="mb-3 font-semibold">Tipo de treino</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODES.map((m, i) => (
            <ModeCard
              key={m.label}
              name="mode"
              label={m.label}
              icon={m.icon}
              description={m.description}
              hint={m.hint}
              wide={i === 0}
              checked={mode === m.mode}
              onChange={() => setMode(m.mode)}
            />
          ))}
        </div>
      </fieldset>
      <div className="sticky bottom-20 z-[5] -mx-5 mt-8 bg-linear-to-t from-paper from-70% to-transparent px-5 pt-6 pb-2 md:static md:mx-0 md:bg-none md:p-0">
        <Button
          size="lg"
          icon={PlayIcon}
          className="w-full md:w-auto md:min-w-56"
          loading={start.isPending}
          onClick={() => start.mutate(request)}
        >
          {start.isPending ? "Começando…" : "Começar"}
        </Button>
      </div>
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
