import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation } from "react-router";
import { getItems } from "./api/client";
import { useLetterMap } from "./components/AlphabetMap";
import { GhostLetter } from "./components/art/GhostLetter";
import { ErrorMessage } from "./components/ErrorMessage";
import { LETTER_GROUPS } from "./components/letterGroups";
import { LetterCard } from "./components/LetterCard";
import { stagger } from "./components/motion";
import { PageHeader } from "./components/PageHeader";
import { ProgressRing } from "./components/ProgressRing";

export function Alphabet() {
  const letters = useQuery({
    queryKey: ["items", "letter"],
    queryFn: ({ signal }) => getItems("letter", signal),
  });
  // Mastery is a bonus here: without it the cards simply show no status.
  const map = useLetterMap();
  const status = new Map(map.data?.map((l) => [l.id, l.status]));

  // The alphabet map links here with #letra-<id>; the router does not scroll to it.
  const { hash } = useLocation();
  const loaded = !!letters.data;
  useEffect(() => {
    if (!loaded || !hash) return;
    const card = document.getElementById(hash.slice(1));
    card?.scrollIntoView();
    // Move focus too, so keyboard and screen reader users land on the letter.
    card?.focus({ preventScroll: true });
  }, [loaded, hash]);

  return (
    <>
      <div className="relative">
        <GhostLetter
          letter="Ш"
          className="-top-[25%] right-[4%] w-[min(15rem,40%)]"
        />
        <PageHeader
          eyebrow="Consulta"
          title="Alfabeto"
          description="As 33 letras russas, em maiúscula e minúscula, com o som aproximado em português."
        />
      </div>
      {letters.isPending && <p className="mt-6 text-ink-2">Carregando…</p>}
      {letters.isError && (
        <div className="mt-6">
          <ErrorMessage
            error={letters.error}
            onRetry={() => letters.refetch()}
          />
        </div>
      )}
      {Object.entries(LETTER_GROUPS).map(
        ([group, { title, description }], index) => {
          const members = letters.data?.filter(
            (l) => l.group === Number(group),
          );
          if (!members?.length) return null;
          const done = members.filter(
            (l) => status.get(l.id) === "mastered",
          ).length;
          return (
            <section
              key={group}
              aria-labelledby={`group-${group}`}
              className="rise mt-12"
              style={stagger(index + 1)}
            >
              <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
                <div className="min-w-0">
                  <h2 id={`group-${group}`}>{title}</h2>
                  <p className="mt-1 text-ink-2">{description}</p>
                </div>
                {map.data && (
                  <ProgressRing
                    value={done}
                    total={members.length}
                    label={`${done} de ${members.length} letras dominadas`}
                    size={52}
                    strokeWidth={5}
                  >
                    <span className="font-serif text-sm font-semibold">
                      {done}/{members.length}
                    </span>
                  </ProgressRing>
                )}
              </div>
              <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3 @[50rem]:gap-4">
                {members.map((letter) => (
                  <li key={letter.id}>
                    <LetterCard
                      id={`letra-${letter.id}`}
                      highlighted={hash === `#letra-${letter.id}`}
                      letter={letter.text}
                      pronunciation={letter.pronunciation}
                      status={status.get(letter.id)}
                      className="h-full"
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        },
      )}
    </>
  );
}
