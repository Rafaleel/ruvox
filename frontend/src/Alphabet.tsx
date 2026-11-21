import { useQuery } from "@tanstack/react-query";
import { getItems } from "./api/client";
import { ErrorMessage } from "./components/ErrorMessage";
import { LetterCard } from "./components/LetterCard";
import { stagger } from "./components/motion";
import { PageHeader } from "./components/PageHeader";

const GROUPS: Record<number, { title: string; description: string }> = {
  1: {
    title: "Grupo 1: iguais ao português",
    description: "Você já conhece a forma e o som. Comece por aqui.",
  },
  2: {
    title: "Grupo 2: parecem latinas, mas soam diferente",
    description: "Cuidado: a forma engana. O som é outro.",
  },
  3: {
    title: "Grupo 3: letras novas",
    description: "Formas que você ainda não viu. Uma de cada vez.",
  },
};

export function Alphabet() {
  const letters = useQuery({
    queryKey: ["items", "letter"],
    queryFn: ({ signal }) => getItems("letter", signal),
  });

  return (
    <>
      <PageHeader
        eyebrow="Consulta"
        title="Alfabeto"
        description="As 33 letras russas, em maiúscula e minúscula, com o som aproximado em português."
      />
      {letters.isPending && <p className="mt-6 text-ink-2">Carregando…</p>}
      {letters.isError && (
        <div className="mt-6">
          <ErrorMessage
            error={letters.error}
            onRetry={() => letters.refetch()}
          />
        </div>
      )}
      {Object.entries(GROUPS).map(([group, { title, description }], index) => {
        const members = letters.data?.filter((l) => l.group === Number(group));
        if (!members?.length) return null;
        return (
          <section
            key={group}
            className="rise mt-10"
            style={stagger(index + 1)}
          >
            <h2>{title}</h2>
            <p className="mt-1 text-ink-2">{description}</p>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {members.map((letter) => (
                <li key={letter.id}>
                  <LetterCard
                    letter={letter.text}
                    pronunciation={letter.pronunciation}
                    className="h-full"
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
