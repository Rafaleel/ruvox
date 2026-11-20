import { useQuery } from "@tanstack/react-query";
import { getItems } from "./api/client";
import { Card } from "./components/Card";
import { ErrorMessage } from "./components/ErrorMessage";

const GROUP_TITLES: Record<number, string> = {
  1: "Grupo 1: iguais ao português",
  2: "Grupo 2: parecem latinas, mas soam diferente",
  3: "Grupo 3: letras novas",
};

export function Alphabet() {
  const letters = useQuery({
    queryKey: ["items", "letter"],
    queryFn: ({ signal }) => getItems("letter", signal),
  });

  return (
    <>
      <h1 className="text-3xl font-extrabold">Alfabeto</h1>
      {letters.isPending && <p className="mt-4 text-muted">Carregando…</p>}
      {letters.isError && (
        <div className="mt-4">
          <ErrorMessage
            error={letters.error}
            onRetry={() => letters.refetch()}
          />
        </div>
      )}
      {Object.entries(GROUP_TITLES).map(([group, title]) => {
        const members = letters.data?.filter((l) => l.group === Number(group));
        if (!members?.length) return null;
        return (
          <section key={group} className="mt-6">
            <h2 className="text-lg font-bold">{title}</h2>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {members.map((letter) => (
                <li key={letter.id}>
                  <Card className="h-full">
                    <p lang="ru" className="text-4xl font-extrabold">
                      {letter.text} {letter.text.toLowerCase()}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {letter.pronunciation}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
