import { useQuery } from "@tanstack/react-query";
import { getStats, type Stats } from "./api/client";
import { Card } from "./components/Card";
import { ErrorMessage } from "./components/ErrorMessage";

const MASTERY = [
  { key: "new", label: "Novos", swatch: "bg-line" },
  { key: "learning", label: "Aprendendo", swatch: "bg-accent/40" },
  { key: "familiar", label: "Familiares", swatch: "bg-accent/75" },
  { key: "mastered", label: "Dominados", swatch: "bg-success" },
] as const;

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** "2026-03-07" -> "07/03" */
const shortDate = (iso: string) => iso.slice(8) + "/" + iso.slice(5, 7);

function Mastery({ mastery }: { mastery: Stats["mastery"] }) {
  const total = MASTERY.reduce((sum, m) => sum + mastery[m.key], 0);
  return (
    <>
      <div
        role="img"
        aria-label={MASTERY.map((m) => `${m.label}: ${mastery[m.key]}`).join(
          ", ",
        )}
        className="flex h-4 w-full overflow-hidden rounded-full bg-line"
      >
        {MASTERY.map((m) => (
          <div
            key={m.key}
            className={`${m.swatch} h-full border-r border-paper last:border-r-0`}
            style={{
              width: `${total > 0 ? (mastery[m.key] / total) * 100 : 0}%`,
            }}
          />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {MASTERY.map((m) => (
          <div key={m.key}>
            <dt className="flex items-center gap-2 text-muted">
              <span
                aria-hidden="true"
                className={`${m.swatch} size-3 rounded-sm border border-line`}
              />
              {m.label}
            </dt>
            <dd className="text-2xl font-extrabold">{mastery[m.key]}</dd>
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
  return (
    <>
      <svg
        viewBox={`0 0 ${days.length * STEP} ${HEIGHT}`}
        role="img"
        aria-label={summary}
        className="h-40 w-full"
        preserveAspectRatio="none"
      >
        {days.map((d, i) => {
          const x = i * STEP + 1;
          const all = (d.answered / max) * (HEIGHT - 2);
          const ok = (d.correct / max) * (HEIGHT - 2);
          return (
            <g key={d.date}>
              {d.answered > 0 && (
                // Outline = every answer, filled = the correct ones.
                <rect
                  x={x + 0.5}
                  y={HEIGHT - all - 0.5}
                  width={BAR - 1}
                  height={all}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {d.correct > 0 && (
                <rect
                  x={x}
                  y={HEIGHT - ok}
                  width={BAR}
                  height={ok}
                  fill="var(--success)"
                />
              )}
            </g>
          );
        })}
        <line
          x1={0}
          x2={days.length * STEP}
          y1={HEIGHT}
          y2={HEIGHT}
          stroke="var(--line)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {first && last && (
        <div
          aria-hidden="true"
          className="mt-1 flex justify-between text-sm text-muted"
        >
          <span>{shortDate(first.date)}</span>
          <span>{shortDate(last.date)}</span>
        </div>
      )}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-muted">
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-3 rounded-sm border-2 border-accent"
          />
          Respostas
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-sm bg-success" />
          Corretas
        </li>
      </ul>
      <details className="mt-3">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold focus-visible:outline-2 focus-visible:outline-accent">
          Ver em tabela
        </summary>
        <table className="w-full text-left">
          <caption className="sr-only">{summary}</caption>
          <thead>
            <tr>
              <th scope="col">Dia</th>
              <th scope="col">Respostas</th>
              <th scope="col">Corretas</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((d) => (
              <tr key={d.date} className="border-t border-line">
                <th scope="row" className="font-normal">
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

export function Progress() {
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: ({ signal }) => getStats(signal),
    retry: false,
  });
  const data = stats.data;
  return (
    <>
      <h1 className="text-4xl font-extrabold tracking-tight">Progresso</h1>
      {stats.isPending && (
        <p className="mt-6 text-muted">Carregando progresso…</p>
      )}
      {stats.isError && (
        <div className="mt-6">
          <ErrorMessage error={stats.error} onRetry={() => stats.refetch()} />
        </div>
      )}
      {data && (
        <div className="mt-6 grid gap-6">
          <Card>
            <h2 className="text-lg font-bold">
              Sequência: {plural(data.streak, "dia", "dias")}
            </h2>
            <p className="text-muted">
              Melhor sequência: {plural(data.best_streak, "dia", "dias")}
            </p>
            {!data.today_done && (
              <p className="mt-2">
                Faça uma sessão com pelo menos 5 respostas hoje
              </p>
            )}
          </Card>
          <section>
            <h2 className="mb-3 text-lg font-bold">Domínio</h2>
            <Mastery mastery={data.mastery} />
          </section>
          <section>
            <h2 className="mb-3 text-lg font-bold">Últimos 30 dias</h2>
            <ActivityChart days={data.days} />
          </section>
        </div>
      )}
    </>
  );
}
