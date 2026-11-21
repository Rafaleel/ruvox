import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { getLetterMap, type LetterStatus } from "../api/client";
import { GhostLetter } from "./art/GhostLetter";
import { cx } from "./cx";
import { ErrorMessage } from "./ErrorMessage";
import { LETTER_GROUPS } from "./letterGroups";
import {
  MASTERY_META,
  MASTERY_ORDER,
  StatusPip,
  type Mastery,
} from "./letterStatus";

/** Shared by every screen that shows the letters' mastery. Keyed under `progress` so a finished session refreshes it. */
export const useLetterMap = () =>
  useQuery({
    queryKey: ["progress", "letters"],
    queryFn: ({ signal }) => getLetterMap(signal),
    retry: false,
  });

/** Counts per status plus the sentence a screen reader gets instead of the grid. */
function summarize(letters: LetterStatus[]) {
  const counts: Record<Mastery, number> = {
    new: 0,
    learning: 0,
    familiar: 0,
    mastered: 0,
  };
  for (const l of letters) counts[l.status] += 1;
  const parts = MASTERY_ORDER.map(
    (s) => `${counts[s]} ${MASTERY_META[s].plural}`,
  );
  return {
    counts,
    sentence: `Mapa do alfabeto, ${letters.length} letras: ${parts.join(", ")}.`,
  };
}

function Tile({
  letter,
  onActive,
}: {
  letter: LetterStatus;
  onActive: (letter: LetterStatus | null) => void;
}) {
  const meta = MASTERY_META[letter.status];
  return (
    <Link
      to={`/alphabet#letra-${letter.id}`}
      aria-label={`${letter.text}: ${meta.label}`}
      onMouseEnter={() => onActive(letter)}
      onMouseLeave={() => onActive(null)}
      onFocus={() => onActive(letter)}
      onBlur={() => onActive(null)}
      // Each tile is its own container so the glyph and the pip scale with it.
      className={cx(
        "lift @container relative grid size-full place-items-center rounded-[18%] select-none",
        meta.tile,
      )}
    >
      <span
        lang="ru"
        aria-hidden="true"
        className="font-serif text-[46cqw] leading-none font-semibold"
      >
        {letter.text}
      </span>
      <StatusPip
        status={letter.status}
        className={cx(
          "absolute top-[7cqw] right-[7cqw] text-[24cqw]",
          meta.pip,
        )}
      />
    </Link>
  );
}

function Legend({ counts }: { counts: Record<Mastery, number> }) {
  return (
    <ul
      aria-hidden="true"
      className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-ink-2 @[34rem]:grid-cols-4"
    >
      {MASTERY_ORDER.map((s) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={cx(
              "grid size-[1.375rem] place-items-center rounded-[0.35rem]",
              MASTERY_META[s].tile,
            )}
          >
            <StatusPip
              status={s}
              className={cx("text-[0.9rem]", MASTERY_META[s].pip)}
            />
          </span>
          <span className="capitalize">{MASTERY_META[s].plural}</span>
          <span className="font-semibold text-ink">{counts[s]}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The signature visualization ("Mapa do alfabeto"): the 33 letters as tiles in
 * their three groups, painted by mastery. Fetches its own data; every tile
 * links to that letter in the alphabet. `legend` can be turned off where the
 * screen already explains the colors.
 */
export function AlphabetMap({
  className,
  legend = true,
  action,
}: {
  className?: string;
  legend?: boolean;
  /** Optional control in the header, e.g. a link to the full alphabet. */
  action?: ReactNode;
}) {
  const query = useLetterMap();
  const [active, setActive] = useState<LetterStatus | null>(null);
  const letters = query.data;
  const summary = letters ? summarize(letters) : null;

  return (
    <section
      aria-labelledby="alphabet-map-title"
      className={cx(
        "@container relative flex flex-col overflow-hidden rounded-sheet bg-sheet p-5 shadow-card @[32rem]:p-6",
        className,
      )}
    >
      <GhostLetter
        letter="Ж"
        className="-right-[8%] -bottom-[10%] w-[42%] max-w-[16rem]"
      />
      <header className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-sm font-semibold tracking-wide text-accent">
            Seu mapa
          </p>
          <h2 id="alphabet-map-title" className="text-h2">
            Mapa do alfabeto
          </h2>
        </div>
        {action}
      </header>

      {query.isPending && (
        <div
          role="status"
          aria-label="Carregando o mapa do alfabeto"
          className="relative mt-5 grid animate-pulse grid-cols-8 gap-1.5 @[28rem]:grid-cols-10"
        >
          {Array.from({ length: 33 }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="aspect-square rounded-[18%] bg-sheet-2"
            />
          ))}
        </div>
      )}
      {query.isError && (
        <div className="relative mt-5">
          <ErrorMessage error={query.error} onRetry={() => query.refetch()} />
        </div>
      )}

      {letters && summary && (
        <>
          <p className="sr-only">{summary.sentence}</p>
          <div className="relative mt-5 grid gap-4">
            {Object.entries(LETTER_GROUPS).map(([group, info]) => {
              const members = letters.filter((l) => l.group === Number(group));
              if (!members.length) return null;
              const done = members.filter(
                (l) => l.status === "mastered",
              ).length;
              return (
                <div key={group}>
                  <p className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-ink">
                      Grupo {group}
                      <span className="ml-2 font-normal text-ink-3">
                        {info.hint}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-ink-3">
                      {done}/{members.length}
                    </span>
                  </p>
                  <ul
                    aria-label={info.title}
                    className="grid grid-cols-8 gap-1.5 @[28rem]:grid-cols-10 @[40rem]:gap-2"
                  >
                    {members.map((letter) => (
                      <li key={letter.id} className="aspect-square">
                        <Tile letter={letter} onActive={setActive} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* The legend; while a tile is hovered or focused it gives way to that
              letter's details (same height, so nothing jumps). */}
          <div className="relative mt-auto pt-5">
            <div
              aria-hidden="true"
              className="flex min-h-[4.25rem] flex-col justify-center border-t border-hairline pt-3"
            >
              {active ? (
                <p className="flex items-center gap-3 text-sm text-ink-2">
                  <span
                    lang="ru"
                    className="shrink-0 font-serif text-2xl font-semibold whitespace-nowrap text-ink"
                  >
                    {active.text} {active.text.toLowerCase()}
                  </span>
                  <span>{active.pronunciation}</span>
                  <span className="ml-auto flex items-center gap-1.5 font-medium text-ink">
                    <StatusPip status={active.status} />
                    <span className="capitalize">
                      {MASTERY_META[active.status].label}
                    </span>
                  </span>
                </p>
              ) : legend ? (
                <Legend counts={summary.counts} />
              ) : (
                <p className="text-sm text-ink-2">
                  {summary.counts.mastered} de {letters.length} letras dominadas
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
