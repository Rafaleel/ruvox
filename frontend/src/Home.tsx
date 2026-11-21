import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Flame, Play } from "lucide-react";
import { Link } from "react-router";
import { getProgress, getStats, health } from "./api/client";
import { buttonClasses } from "./components/Button";
import { Card } from "./components/Card";
import { ErrorMessage } from "./components/ErrorMessage";
import { Icon } from "./components/Icon";
import { stagger } from "./components/motion";
import { ProgressRing } from "./components/ProgressRing";
import { Stat } from "./components/Stat";

const GROUP_HINTS: Record<number, string> = {
  1: "iguais às nossas",
  2: "parecem, mas não são",
  3: "letras novas",
};

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
      <section
        className="rise margin-rule rounded-hero bg-sheet py-7 pr-6 pl-9 shadow-card md:py-10 md:pl-16"
        style={stagger(0)}
      >
        <p
          lang="ru"
          className="font-serif text-letter leading-none font-semibold md:text-letter-hero"
        >
          Привет
        </p>
        <p className="mt-3 inline-block rounded-full bg-sheet-2 px-2.5 py-0.5 text-sm font-medium text-ink-2">
          pri-VIÉT
        </p>
        <h1 className="mt-5 text-h1">Vamos praticar?</h1>
        <p className="mt-2 max-w-prose text-ink-2">
          {firstTime
            ? "Sua primeira sessão leva uns 5 minutos. Começamos pelas letras que você já conhece."
            : "Uma sessão curta por dia vale mais que uma longa por semana."}
        </p>
        <Link
          to="/play"
          className={`${buttonClasses("primary", "lg")} mt-6 w-full md:w-auto md:min-w-56`}
        >
          <Icon icon={Play} size={20} fill="currentColor" />
          Jogar agora
        </Link>
      </section>

      {progress.isPending && (
        <p className="mt-8 text-ink-2">Carregando progresso…</p>
      )}
      {progress.isError && (
        <div className="mt-8">
          <ErrorMessage
            error={progress.error}
            onRetry={() => progress.refetch()}
          />
        </div>
      )}
      {data && (
        <>
          {!firstTime && (
            <div
              className={`rise mt-8 grid gap-3 ${streak === undefined ? "grid-cols-2" : "grid-cols-3"}`}
              style={stagger(1)}
            >
              <Stat
                label="Para revisar"
                value={data.due_count}
                hint={data.due_count === 1 ? "item agora" : "itens agora"}
              />
              {streak !== undefined && (
                <Link
                  to="/progress"
                  aria-label={`Sequência: ${streak} ${streak === 1 ? "dia" : "dias"}`}
                  className="block rounded-card"
                >
                  <Stat
                    tone="gold"
                    icon={Flame}
                    label="Sequência"
                    value={streak}
                    hint={streak === 1 ? "dia" : "dias"}
                    className="h-full"
                  />
                </Link>
              )}
              <Stat
                label="Palavras"
                value={data.words_unlocked}
                hint={`de ${data.words_total} liberadas`}
              />
            </div>
          )}

          <section className="rise mt-10" style={stagger(2)}>
            <h2 className="mb-4">Seu progresso</h2>
            <div className="grid grid-cols-3 gap-3">
              {data.groups.map((g) => (
                <Card
                  key={g.group}
                  className="flex flex-col items-center gap-2 px-2 py-4 text-center"
                >
                  <ProgressRing
                    value={g.learned}
                    total={g.total}
                    label={`Grupo ${g.group}: ${g.learned} de ${g.total} letras`}
                    size={68}
                    strokeWidth={7}
                  >
                    <span className="font-serif text-xl font-semibold">
                      {g.learned}
                      <span className="text-sm font-normal text-ink-3">
                        /{g.total}
                      </span>
                    </span>
                  </ProgressRing>
                  <p className="font-semibold">Grupo {g.group}</p>
                  <p className="text-xs text-ink-3">{GROUP_HINTS[g.group]}</p>
                </Card>
              ))}
            </div>
          </section>

          <Link
            to="/alphabet"
            className="rise group mt-4 flex items-center gap-4 rounded-card bg-sheet p-4 shadow-card transition-transform duration-150 ease-out-soft active:scale-[.98]"
            style={stagger(3)}
          >
            <span
              aria-hidden="true"
              lang="ru"
              className="grid size-14 shrink-0 place-items-center rounded-control bg-sheet-2 font-serif text-2xl font-semibold"
            >
              Ая
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Alfabeto</span>
              <span className="block text-sm text-ink-2">
                Consulte as letras russas e como se pronunciam.
              </span>
            </span>
            <Icon icon={ChevronRight} className="text-ink-3" />
          </Link>
        </>
      )}

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
