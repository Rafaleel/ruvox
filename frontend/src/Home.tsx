import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Flame, Play } from "lucide-react";
import { Link } from "react-router";
import { getProgress, getStats, health, type Progress } from "./api/client";
import { AlphabetMap } from "./components/AlphabetMap";
import { DomeSkyline } from "./components/art/DomeSkyline";
import { GhostLetter } from "./components/art/GhostLetter";
import { NotebookCorner } from "./components/art/NotebookCorner";
import { StampFrame } from "./components/art/StampFrame";
import { buttonClasses } from "./components/Button";
import { CountUp } from "./components/CountUp";
import { ErrorMessage } from "./components/ErrorMessage";
import { Icon } from "./components/Icon";
import { stagger } from "./components/motion";

function Hero({ firstTime }: { firstTime: boolean }) {
  return (
    <section
      aria-labelledby="home-title"
      className="rise @container relative flex flex-col overflow-hidden rounded-sheet bg-sheet shadow-card"
      style={stagger(0)}
    >
      <div
        aria-hidden="true"
        className="bg-linear-to-b from-sheet-2 to-sheet pt-6"
      >
        <DomeSkyline className="mx-auto block max-h-[8rem] w-full" />
      </div>
      <div className="margin-rule relative flex flex-1 flex-col pt-2 pr-7 pb-8 pl-12 @[30rem]:pl-14">
        <div aria-hidden="true" className="ruled absolute inset-0" />
        <GhostLetter
          letter="Я"
          className="-right-[12%] -bottom-[14%] w-[58%]"
        />
        <p
          lang="ru"
          className="relative font-serif text-[clamp(4rem,21cqw,5.5rem)] leading-[1.05] font-semibold tracking-tight"
        >
          Привет
        </p>
        <p className="relative mt-1 w-fit rounded-full bg-sheet-2 px-3 py-0.5 text-sm font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--hairline)]">
          pri-VIÉT
        </p>
        <h1
          id="home-title"
          className="relative mt-5 text-[clamp(1.9375rem,7cqw,2.5rem)] leading-[1.1] tracking-tight"
        >
          Vamos praticar?
        </h1>
        <p className="relative mt-3 max-w-[30ch] text-ink-2">
          {firstTime
            ? "Sua primeira sessão leva uns 5 minutos. Começamos pelas letras que você já conhece."
            : "Uma sessão curta por dia vale mais que uma longa por semana."}
        </p>
        <div className="relative mt-auto pt-6">
          <Link
            to="/play"
            className={`${buttonClasses("primary", "lg")} w-full @[30rem]:w-auto @[30rem]:min-w-60`}
          >
            <Icon icon={Play} fill="currentColor" />
            Jogar agora
          </Link>
          <p className="mt-2.5 text-sm text-ink-3">
            {firstTime
              ? "Sem pressa: você pode parar quando quiser."
              : "Leva uns 5 minutos, no seu ritmo."}
          </p>
        </div>
        <NotebookCorner />
      </div>
    </section>
  );
}

const card =
  "flex flex-col rounded-card bg-sheet p-4 shadow-card @[24rem]:p-5 @[40rem]:p-6";
const label = "text-sm font-medium text-ink-2";
const figure =
  "font-serif text-[2.75rem] leading-none font-semibold tracking-tight text-ink @[40rem]:text-[3.75rem]";

function StatCards({
  data,
  streak,
}: {
  data: Progress;
  streak: number | undefined;
}) {
  const share = data.words_total
    ? Math.min(1, data.words_unlocked / data.words_total)
    : 0;
  return (
    <div
      className={`rise @container grid gap-3 ${streak === undefined ? "grid-cols-2" : "grid-cols-3"}`}
      style={stagger(2)}
    >
      <div className={card}>
        <p className={label}>Para revisar</p>
        <p className={`${figure} mt-3`}>
          <CountUp value={data.due_count} />
        </p>
        <p className="mt-auto pt-2 text-sm text-ink-3">
          {data.due_count === 1 ? "item agora" : "itens agora"}
        </p>
      </div>
      {streak !== undefined && (
        <Link
          to="/progress"
          aria-label={`Sequência: ${streak} ${streak === 1 ? "dia" : "dias"}`}
          className="stamp-in lift block rounded-[0.2em]"
        >
          <StampFrame className="flex h-full flex-col p-4 @[24rem]:p-5">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Icon icon={Flame} className="text-gold" />
              Sequência
            </p>
            <p className={`${figure} mt-3 text-gold-ink`}>
              <CountUp value={streak} />
            </p>
            <p className="mt-auto pt-2 text-sm font-medium">
              {streak === 1 ? "dia" : "dias"}
            </p>
          </StampFrame>
        </Link>
      )}
      <div className={card}>
        <p className={label}>Palavras</p>
        <p className={`${figure} mt-3`}>
          <CountUp value={data.words_unlocked} />
        </p>
        <p className="mt-auto pt-2 text-sm text-ink-3">
          de {data.words_total} liberadas
        </p>
        <div
          aria-hidden="true"
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-sheet-2"
        >
          <div
            className="h-full origin-left rounded-full bg-accent"
            style={{ transform: `scaleX(${share})` }}
          />
        </div>
      </div>
    </div>
  );
}

const steps = [
  "Aprenda as primeiras letras, as que você já conhece",
  "Escolha o som certo e veja a letra ganhar cor no mapa",
  "Volte amanhã: o caderno lembra do que você precisa rever",
];

function FirstSteps() {
  return (
    <section
      aria-labelledby="first-steps"
      className="rise rounded-card bg-sheet p-5 shadow-card"
      style={stagger(2)}
    >
      <h2 id="first-steps" className="text-h3">
        Como funciona
      </h2>
      <ol className="mt-3 grid gap-3">
        {steps.map((step, i) => (
          <li key={step} className="flex items-start gap-3 text-ink-2">
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft font-serif text-sm font-semibold text-accent"
            >
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Home() {
  const result = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => health(signal),
    retry: false,
  });
  const progress = useQuery({
    queryKey: ["progress"],
    queryFn: ({ signal }) => getProgress(signal),
    retry: false,
  });
  // The streak is optional: a failed stats request just hides it.
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: ({ signal }) => getStats(signal),
    retry: false,
  });
  const streak = stats.data?.streak;
  const connected = result.data?.status === "ok";
  const data = progress.data;
  const firstTime =
    !!data &&
    data.due_count === 0 &&
    data.groups.every((g) => g.learned === 0) &&
    !streak;
  return (
    <>
      <div className="grid gap-6 @[50rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] @[50rem]:gap-8">
        <Hero firstTime={firstTime} />
        <div className="rise" style={stagger(1)}>
          <AlphabetMap
            className="h-full"
            action={
              <Link
                to="/alphabet"
                className="group flex items-center gap-1 rounded-control py-1 text-sm font-semibold text-accent"
              >
                Ver o alfabeto completo
                <Icon
                  icon={ArrowRight}
                  size="1em"
                  className="transition-transform duration-150 ease-out-soft group-hover:translate-x-0.5"
                />
              </Link>
            }
          />
        </div>
        <div className="@[50rem]:col-span-2">
          {progress.isPending && (
            <p className="text-ink-2">Carregando progresso…</p>
          )}
          {progress.isError && (
            <ErrorMessage
              error={progress.error}
              onRetry={() => progress.refetch()}
            />
          )}
          {data &&
            (firstTime ? (
              <FirstSteps />
            ) : (
              <StatCards data={data} streak={streak} />
            ))}
        </div>
      </div>

      <p
        role="status"
        className="mt-10 flex items-center gap-2.5 text-sm text-ink-3"
      >
        <span
          aria-hidden="true"
          className={`size-2 rounded-full ${connected ? "bg-success" : "bg-ink-3"}`}
        />
        {result.isPending
          ? "Conectando ao serviço local…"
          : connected
            ? "Serviço local conectado"
            : "Serviço local indisponível"}
      </p>
    </>
  );
}
