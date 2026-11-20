import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { getProgress, health } from "./api/client";
import { buttonClasses } from "./components/Button";
import { Card } from "./components/Card";
import { ErrorMessage } from "./components/ErrorMessage";
import { ProgressBar } from "./components/ProgressBar";

function Stat({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span>{label}</span>
        <span className="font-semibold">
          {value}/{total}
        </span>
      </div>
      <ProgressBar value={value} max={total} label={label} />
    </div>
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
  const connected = result.data?.status === "ok";
  const data = progress.data;
  return (
    <>
      <h1 className="text-6xl font-extrabold tracking-tighter">Ruvox</h1>
      <p className="mt-3 text-xl">Aprenda russo, do alfabeto às músicas.</p>
      <Link
        to="/play"
        className={`${buttonClasses()} mt-6 min-h-16 w-full text-2xl`}
      >
        Jogar agora
      </Link>

      {progress.isPending && (
        <p className="mt-6 text-muted">Carregando progresso…</p>
      )}
      {progress.isError && (
        <div className="mt-6">
          <ErrorMessage
            error={progress.error}
            onRetry={() => progress.refetch()}
          />
        </div>
      )}
      {data && (
        <>
          <Card className="mt-6">
            <p className="text-3xl font-extrabold">{data.due_count}</p>
            <p className="text-muted">
              {data.due_count === 1 ? "item" : "itens"} para revisar agora
            </p>
          </Card>
          <h2 className="mt-6 mb-3 text-lg font-bold">Seu progresso</h2>
          <div className="grid gap-4">
            {data.groups.map((g) => (
              <Stat
                key={g.group}
                label={`Grupo ${g.group}`}
                value={g.learned}
                total={g.total}
              />
            ))}
            <Stat
              label="Palavras liberadas"
              value={data.words_unlocked}
              total={data.words_total}
            />
          </div>
        </>
      )}

      <p
        role="status"
        className="mt-8 flex items-center gap-2.5 border-t border-line pt-4 text-muted"
      >
        <span
          aria-hidden="true"
          className={`size-2.5 rounded-full ${connected ? "bg-success" : "bg-muted"}`}
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
