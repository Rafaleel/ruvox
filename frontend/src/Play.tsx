import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Check,
  Keyboard,
  Languages,
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
import { GhostLetter } from "./components/art/GhostLetter";
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
    label: "Alfabeto",
    mode: 8,
    icon: Languages,
    description: "Só as letras: leia cada uma e ache o som certo.",
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
  featured,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  icon: LucideIcon;
  description: string;
  hint?: string;
  /** The recommended choice: spans the whole row. */
  featured?: boolean;
  checked: boolean;
  onChange: () => void;
}) {
  const id = `mode-${label}`;
  return (
    <label
      className={cx(
        "group relative flex cursor-pointer rounded-card bg-sheet p-4 shadow-card @[34rem]:p-5",
        "transition-[transform,box-shadow,background-color] duration-150 ease-out-soft hover:-translate-y-0.5 hover:shadow-[0_0_0_1.5px_var(--rule)] active:scale-[.98]",
        "has-checked:bg-accent-soft has-checked:shadow-[0_0_0_2px_var(--accent)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent",
        featured ? "items-start gap-4 @[34rem]:col-span-2" : "flex-col gap-3",
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
        className="grid size-[3.25rem] shrink-0 place-items-center rounded-control bg-sheet-2 text-ink-2 transition-colors peer-checked:bg-accent peer-checked:text-on-accent"
      >
        <Icon icon={icon} size={26} />
      </span>
      <span className={cx("min-w-0 flex-1", featured && "pr-8")}>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span id={`${id}-title`} className="font-serif text-xl font-semibold">
            {label}
          </span>
          {featured && <Badge tone="gold">Recomendado</Badge>}
        </span>
        <span id={`${id}-desc`} className="mt-1 block text-ink-2">
          {description}
          {hint && (
            <>
              {" "}
              <span className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-gold-ink">
                <Icon icon={Music2} size={16} className="mt-0.5 shrink-0" />
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

  const chosen = MODES.find((m) => m.mode === mode) ?? MODES[0];
  const minutes = Math.ceil(size / 2);
  return (
    <>
      <PageHeader
        title="Jogar"
        description="Uma sessão curta, no seu ritmo. Escolha como quer treinar."
        className="rise"
      />
      {songId !== null && (
        <div
          className="rise mt-6 flex items-center justify-between gap-3 rounded-card bg-gold-soft p-3 pl-4 text-gold-ink shadow-[inset_0_0_0_1px_var(--gold)]"
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
      <div className="mt-8 grid gap-8 @[52rem]:grid-cols-[minmax(0,1fr)_21rem] @[52rem]:items-start @[52rem]:gap-10">
        <div className="grid gap-8">
          <section className="rise" style={stagger(2)}>
            <h2 className="mb-3 font-sans text-lg font-semibold">
              Quantas perguntas?
            </h2>
            <Segmented
              label="Quantas perguntas?"
              size="lg"
              className="w-full @[34rem]:w-96"
              options={SIZES.map((n) => ({
                value: String(n),
                label: String(n),
              }))}
              value={String(size)}
              onChange={(v) => setSize(Number(v))}
            />
          </section>
          <fieldset className="rise" style={stagger(3)}>
            <legend className="mb-3 text-lg font-semibold">
              Tipo de treino
            </legend>
            <div className="grid gap-3 @[34rem]:grid-cols-2">
              {MODES.map((m, i) => (
                <ModeCard
                  key={m.label}
                  name="mode"
                  label={m.label}
                  icon={m.icon}
                  description={m.description}
                  hint={m.hint}
                  featured={i === 0}
                  checked={mode === m.mode}
                  onChange={() => setMode(m.mode)}
                />
              ))}
            </div>
          </fieldset>
        </div>

        {/* Narrow: a bar floating above the dock. Wide: a panel beside the modes. */}
        <aside
          aria-label="Resumo da sessão"
          className="rise sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-20 @[52rem]:top-6 @[52rem]:bottom-auto"
          style={stagger(4)}
        >
          {start.isError && (
            <div className="mb-3">
              <ErrorMessage
                error={start.error}
                onRetry={() => start.mutate(request)}
              />
            </div>
          )}
          <div className="relative flex items-center gap-3 overflow-hidden rounded-card bg-sheet p-3 shadow-float @[52rem]:flex-col @[52rem]:items-stretch @[52rem]:gap-6 @[52rem]:rounded-hero @[52rem]:p-6 @[52rem]:shadow-card">
            <GhostLetter
              letter="Я"
              className="-right-6 -bottom-8 hidden w-56 @[52rem]:block"
            />
            <div className="relative flex min-w-0 flex-1 items-center gap-3 @[52rem]:flex-none @[52rem]:flex-col @[52rem]:items-start @[52rem]:gap-4">
              <p className="hidden text-sm font-semibold tracking-wide text-accent uppercase @[52rem]:block">
                Sua sessão
              </p>
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-control bg-accent text-on-accent @[52rem]:size-14"
              >
                <Icon icon={chosen.icon} size={26} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-serif text-xl font-semibold @[52rem]:text-3xl">
                  {chosen.label}
                </p>
                <p className="text-sm text-ink-2 @[52rem]:mt-1 @[52rem]:text-base">
                  {size} perguntas · {minutes} min
                </p>
              </div>
            </div>
            <Button
              size="lg"
              icon={PlayIcon}
              className="relative shrink-0 @[52rem]:w-full"
              loading={start.isPending}
              onClick={() => start.mutate(request)}
            >
              {start.isPending ? "Começando…" : "Começar"}
            </Button>
            <p className="relative hidden text-sm text-ink-3 @[52rem]:block">
              Sem pressa: você pode sair quando quiser.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
