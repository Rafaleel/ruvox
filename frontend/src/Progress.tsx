import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Flame, Play } from "lucide-react";
import { Link } from "react-router";
import { getStats, type Stats } from "./api/client";
import { AlphabetMap } from "./components/AlphabetMap";
import { DomeSkyline } from "./components/art/DomeSkyline";
import { Laurel } from "./components/art/Laurel";
import { StampFrame } from "./components/art/StampFrame";
import { Badge } from "./components/Badge";
import { buttonClasses } from "./components/Button";
import { cx } from "./components/cx";
import { CountUp } from "./components/CountUp";
import { ErrorMessage } from "./components/ErrorMessage";
import { Icon } from "./components/Icon";
import { StatusPip, type Mastery } from "./components/letterStatus";
import { stagger } from "./components/motion";
import { Notice } from "./components/Notice";
import { PageHeader } from "./components/PageHeader";

const MASTERY: {
  key: Mastery;
  label: string;
  segment: string;
  pip: string;
}[] = [
  {
    key: "new",
    label: "Novos",
    // Stripes, not a flat grey: "not started" reads without relying on color.
    segment:
      "bg-[repeating-linear-gradient(135deg,transparent_0_0.3rem,var(--rule)_0.3rem_0.4rem)] bg-sheet-2",
    pip: "text-ink-3",
  },
  {
    key: "learning",
    label: "Aprendendo",
    segment: "bg-accent/60",
    pip: "text-accent",
  },
  {
    key: "familiar",
    label: "Familiares",
    segment: "bg-gold",
    pip: "text-gold-ink",
  },
  {
    key: "mastered",
    label: "Dominados",
    segment: "bg-success",
    pip: "text-success",
  },
];

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** "2026-03-07" -> "07/03" */
const shortDate = (iso: string) => iso.slice(8) + "/" + iso.slice(5, 7);

const panel = "rounded-sheet bg-sheet p-5 shadow-card @[32rem]:p-6";

function Mastery({ mastery }: { mastery: Stats["mastery"] }) {
  const total = MASTERY.reduce((sum, m) => sum + mastery[m.key], 0);
  return (
    <>
      <div
        role="img"
        aria-label={MASTERY.map((m) => `${m.label}: ${mastery[m.key]}`).join(
          ", ",
        )}
        className="flex h-6 w-full gap-0.5 overflow-hidden rounded-full bg-sheet shadow-[0_0_0_1px_var(--hairline)]"
      >
        {MASTERY.map((m) => (
          <div
            key={m.key}
            className={cx(
              m.segment,
              "h-full first:rounded-l-full last:rounded-r-full",
            )}
            style={{
              width: `${total > 0 ? (mastery[m.key] / total) * 100 : 0}%`,
            }}
          />
        ))}
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 @[34rem]:grid-cols-4">
        {MASTERY.map((m) => (
          <div key={m.key}>
            <dt className="flex items-center gap-1.5 text-sm text-ink-2">
              <StatusPip status={m.key} className={cx("text-base", m.pip)} />
              {m.label}
            </dt>
            <dd className="mt-0.5 font-serif text-3xl font-semibold tracking-tight">
              {mastery[m.key]}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

const BAR = 8;
const STEP = 10;
const HEIGHT = 100;

function ActivityChart({ days }: { days: Stats["days"] }) {
  const max = Math.max(5, ...days.map((d) => d.answered));
  const total = days.reduce((sum, d) => sum + d.answered, 0);
  const right = days.reduce((sum, d) => sum + d.correct, 0);
  const summary = `Respostas por dia nos últimos ${days.length} dias: ${total} no total, ${right} corretas.`;
  const first = days[0];
  const last = days[days.length - 1];
  const width = days.length * STEP;
  return (
    <>
      <p className="flex items-baseline gap-3 text-sm text-ink-2">
        {total === 0 ? (
          "Nenhuma resposta neste período ainda."
        ) : (
          <>
            <span className="font-serif text-4xl leading-none font-semibold tracking-tight text-ink">
              {Math.round((right / total) * 100)}%
            </span>
            <span>corretas em {plural(total, "resposta", "respostas")}</span>
          </>
        )}
      </p>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={summary}
        className="mt-4 h-44 w-full @[40rem]:h-56"
        preserveAspectRatio="none"
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0}
            x2={width}
            y1={HEIGHT * f}
            y2={HEIGHT * f}
            stroke="var(--hairline)"
            strokeWidth={1}
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line
          x1={0}
          x2={width}
          y1={HEIGHT - 0.5}
          y2={HEIGHT - 0.5}
          stroke="var(--rule)"
          strokeWidth={1}
          opacity={0.6}
          vectorEffect="non-scaling-stroke"
        />
        {days.map((d, i) => {
          const x = i * STEP + 1;
          const all = (d.answered / max) * (HEIGHT - 2);
          const ok = (d.correct / max) * (HEIGHT - 2);
          return (
            <g key={d.date}>
              {d.answered === 0 && (
                // A tally mark so empty days still read as days.
                <line
                  x1={x + 1}
                  x2={x + BAR - 1}
                  y1={HEIGHT - 3}
                  y2={HEIGHT - 3}
                  stroke="var(--rule)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  opacity={0.4}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {d.answered > 0 && (
                // Pale = every answer, solid = the correct ones.
                <rect
                  x={x}
                  y={HEIGHT - all}
                  width={BAR}
                  height={all}
                  rx={1}
                  fill="var(--accent)"
                  opacity={0.35}
                />
              )}
              {d.correct > 0 && (
                <rect
                  x={x}
                  y={HEIGHT - ok}
                  width={BAR}
                  height={ok}
                  rx={1}
                  fill="var(--success)"
                />
              )}
            </g>
          );
        })}
      </svg>
      {first && last && (
        <div
          aria-hidden="true"
          className="mt-1 flex justify-between text-sm text-ink-3"
        >
          <span>{shortDate(first.date)}</span>
          <span>{shortDate(last.date)}</span>
        </div>
      )}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-3 rounded-sm bg-accent opacity-35"
          />
          Respostas
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-sm bg-success" />
          Corretas
        </li>
      </ul>
      <details className="mt-3">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-ink-2 hover:text-ink">
          Ver em tabela
        </summary>
        <table className="w-full text-left">
          <caption className="sr-only">{summary}</caption>
          <thead className="text-sm text-ink-2">
            <tr>
              <th scope="col" className="py-1 font-medium">
                Dia
              </th>
              <th scope="col" className="py-1 font-medium">
                Respostas
              </th>
              <th scope="col" className="py-1 font-medium">
                Corretas
              </th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((d) => (
              <tr key={d.date} className="border-t border-hairline">
                <th scope="row" className="py-1 font-normal">
                  {shortDate(d.date)}
                </th>
                <td>{d.answered}</td>
                <td>{d.correct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

/** The streak as a gold stamp and the best streak under a laurel. */
function Streaks({ data }: { data: Stats }) {
  return (
    <div className="grid content-start gap-4">
      <div className="grid grid-cols-2 items-center gap-4">
        <div className="stamp-in h-full">
          <StampFrame
            tilt
            className="flex h-full flex-col justify-between gap-3 p-4 @[32rem]:p-5"
          >
            <p
              aria-hidden="true"
              className="flex items-center gap-1.5 text-sm font-semibold"
            >
              <Icon icon={Flame} className="text-gold" />
              Sequência
            </p>
            <h2 className="sr-only">
              Sequência: {plural(data.streak, "dia", "dias")}
            </h2>
            <p
              aria-hidden="true"
              className="font-serif text-[clamp(3.25rem,16cqw,4.5rem)] leading-none font-semibold tracking-tight"
            >
              <CountUp value={data.streak} />
            </p>
            <p aria-hidden="true" className="text-sm font-medium">
              {data.streak === 1 ? "dia seguido" : "dias seguidos"}
            </p>
          </StampFrame>
        </div>
        <div
          className="stamp-in grid place-items-center gap-1 text-center"
          style={stagger(1)}
        >
          <Laurel className="w-[min(100%,10rem)]">
            <span
              aria-hidden="true"
              className="font-serif text-4xl leading-none font-semibold tracking-tight text-gold-ink"
            >
              {data.best_streak}
            </span>
          </Laurel>
          <p className="text-sm leading-snug font-semibold text-ink-2">
            Melhor sequência: {plural(data.best_streak, "dia", "dias")}
          </p>
        </div>
      </div>
      {data.today_done ? (
        <Badge tone="success" icon={CircleCheck} className="w-fit">
          Meta de hoje cumprida
        </Badge>
      ) : (
        <Notice tone="warning">
          Faça uma sessão com pelo menos 5 respostas hoje
        </Notice>
      )}
    </div>
  );
}

/** Shown before the first answer: the notebook is still blank. */
function BlankNotebook() {
  return (
    <div className="overflow-hidden rounded-sheet bg-sheet shadow-card">
      <div
        aria-hidden="true"
        className="bg-linear-to-b from-sheet-2 to-sheet pt-6"
      >
        <DomeSkyline className="block w-full" />
      </div>
      <div className="grid justify-items-start gap-3 p-6">
        <h2 className="text-h2">Seu caderno ainda está em branco</h2>
        <p className="max-w-[34ch] text-ink-2">
          Faça a primeira sessão e as letras começam a ganhar cor no mapa. Aqui
          vão aparecer sua sequência, seu domínio e seus dias de prática.
        </p>
        <Link to="/play" className={cx(buttonClasses("primary", "lg"), "mt-2")}>
          <Icon icon={Play} fill="currentColor" />
          Jogar agora
        </Link>
      </div>
    </div>
  );
}

export function Progress() {
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: ({ signal }) => getStats(signal),
    retry: false,
  });
  const data = stats.data;
  const blank =
    !!data &&
    data.streak === 0 &&
    data.best_streak === 0 &&
    data.days.every((d) => d.answered === 0);
  return (
    <>
      <PageHeader
        eyebrow="Seu caderno"
        title="Progresso"
        description="O que você já dominou e como tem sido a sua rotina."
      />
      {stats.isPending && (
        <p className="mt-8 text-ink-2">Carregando progresso…</p>
      )}
      {stats.isError && (
        <div className="mt-8">
          <ErrorMessage error={stats.error} onRetry={() => stats.refetch()} />
        </div>
      )}
      {data && (
        <div className="@container mt-8 grid gap-6 @[50rem]:grid-cols-12 @[50rem]:content-start @[50rem]:gap-8">
          <div
            className="rise @[50rem]:col-span-5 @[50rem]:col-start-8 @[50rem]:row-start-1"
            style={stagger(0)}
          >
            {blank ? <BlankNotebook /> : <Streaks data={data} />}
          </div>
          <div
            className="rise @[50rem]:col-span-7 @[50rem]:col-start-1 @[50rem]:row-span-2 @[50rem]:row-start-1"
            style={stagger(1)}
          >
            <AlphabetMap className="h-full" />
          </div>
          {!blank && (
            <>
              <section
                aria-labelledby="mastery-title"
                className={cx(
                  panel,
                  "rise @[50rem]:col-span-5 @[50rem]:col-start-8 @[50rem]:row-start-2",
                )}
                style={stagger(2)}
              >
                <h2 id="mastery-title" className="mb-4 text-h3">
                  Domínio
                </h2>
                <Mastery mastery={data.mastery} />
              </section>
              <section
                aria-labelledby="activity-title"
                className={cx(panel, "rise @[50rem]:col-span-12")}
                style={stagger(3)}
              >
                <h2 id="activity-title" className="mb-3 text-h3">
                  Últimos 30 dias
                </h2>
                <ActivityChart days={data.days} />
              </section>
            </>
          )}
        </div>
      )}
    </>
  );
}
