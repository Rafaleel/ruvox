import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Flame, Trophy } from "lucide-react";
import { getStats, type Stats } from "./api/client";
import { Badge } from "./components/Badge";
import { Card } from "./components/Card";
import { ErrorMessage } from "./components/ErrorMessage";
import { Icon } from "./components/Icon";
import { stagger } from "./components/motion";
import { Notice } from "./components/Notice";
import { PageHeader } from "./components/PageHeader";

const MASTERY = [
  { key: "new", label: "Novos", swatch: "bg-rule/40" },
  { key: "learning", label: "Aprendendo", swatch: "bg-gold/60" },
  { key: "familiar", label: "Familiares", swatch: "bg-gold" },
  { key: "mastered", label: "Dominados", swatch: "bg-success" },
] as const;

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** "2026-03-07" -> "07/03" */
const shortDate = (iso: string) => iso.slice(8) + "/" + iso.slice(5, 7);

/** The gold "postage stamp" used for streaks. */
const stamp =
  "rounded-card bg-gold-soft p-4 text-gold-ink outline-2 -outline-offset-6 outline-gold/50 outline-dashed";

function Mastery({ mastery }: { mastery: Stats["mastery"] }) {
  const total = MASTERY.reduce((sum, m) => sum + mastery[m.key], 0);
  return (
    <>
      <div
        role="img"
        aria-label={MASTERY.map((m) => `${m.label}: ${mastery[m.key]}`).join(
          ", ",
        )}
        className="flex h-5 w-full overflow-hidden rounded-full bg-sheet-2 shadow-[inset_0_0_0_1px_var(--hairline)]"
      >
        {MASTERY.map((m) => (
          <div
            key={m.key}
            className={`${m.swatch} h-full border-r-2 border-sheet last:border-r-0`}
            style={{
              width: `${total > 0 ? (mastery[m.key] / total) * 100 : 0}%`,
            }}
          />
        ))}
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        {MASTERY.map((m) => (
          <div key={m.key}>
            <dt className="flex items-center gap-2 text-sm text-ink-2">
              <span
                aria-hidden="true"
                className={`${m.swatch} size-3 rounded-full shadow-[inset_0_0_0_1px_var(--hairline)]`}
              />
              {m.label}
            </dt>
            <dd className="mt-0.5 font-serif text-3xl font-semibold">
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
  return (
    <>
      <p className="text-sm text-ink-2">
        {total === 0
          ? "Nenhuma resposta neste período ainda."
          : `${plural(total, "resposta", "respostas")}, ${Math.round((right / total) * 100)}% corretas`}
      </p>
      <svg
        viewBox={`0 0 ${days.length * STEP} ${HEIGHT}`}
        role="img"
        aria-label={summary}
        className="mt-3 h-40 w-full"
        preserveAspectRatio="none"
      >
        <line
          x1={0}
          x2={days.length * STEP}
          y1={HEIGHT / 2}
          y2={HEIGHT / 2}
          stroke="var(--hairline)"
          strokeWidth={1}
          strokeDasharray="3 4"
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
                  x1={x}
                  x2={x + BAR}
                  y1={HEIGHT - 1}
                  y2={HEIGHT - 1}
                  stroke="var(--rule)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  opacity={0.45}
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
                  fill="var(--accent)"
                  opacity={0.3}
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
            className="size-3 rounded-sm bg-accent opacity-30"
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

export function Progress() {
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: ({ signal }) => getStats(signal),
    retry: false,
  });
  const data = stats.data;
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
        <div className="mt-8 grid gap-6">
          <div className="rise grid gap-3" style={stagger(0)}>
            <div className="grid grid-cols-2 gap-3">
              <div className={stamp}>
                <Icon icon={Flame} size={32} className="text-gold" />
                <h2 className="mt-3 text-h3">
                  Sequência: {plural(data.streak, "dia", "dias")}
                </h2>
              </div>
              <div className={stamp}>
                <Icon icon={Trophy} size={32} className="text-gold" />
                <p className="mt-3 font-serif text-h3 leading-tight font-semibold">
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
          <Card className="rise" style={stagger(1)}>
            <h2 className="mb-4 text-h3">Domínio</h2>
            <Mastery mastery={data.mastery} />
          </Card>
          <Card className="rise" style={stagger(2)}>
            <h2 className="mb-1 text-h3">Últimos 30 dias</h2>
            <ActivityChart days={data.days} />
          </Card>
        </div>
      )}
    </>
  );
}
