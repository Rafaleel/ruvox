import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { getItems } from "../api/client";
import { Button } from "./Button";
import { ErrorMessage } from "./ErrorMessage";
import { LETTER_GROUPS } from "./letterGroups";

/** Quick-look alphabet for use mid-session: every letter with its sound. Escape closes it. */
export function AlphabetReference({ onClose }: { onClose: () => void }) {
  const letters = useQuery({
    queryKey: ["items", "letter"],
    queryFn: ({ signal }) => getItems("letter", signal),
  });
  return (
    <section
      role="dialog"
      aria-label="Consulta do alfabeto"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="rise mt-3 rounded-card bg-sheet-2 p-4 shadow-[inset_0_0_0_1px_var(--hairline)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg">Alfabeto</h2>
        <Button variant="ghost" icon={X} autoFocus onClick={onClose}>
          Fechar<span className="sr-only"> o alfabeto</span>
        </Button>
      </div>
      {letters.isPending && <p className="mt-3 text-ink-2">Carregando…</p>}
      {letters.isError && (
        <ErrorMessage error={letters.error} onRetry={() => letters.refetch()} />
      )}
      <div className="mt-2 max-h-[40vh] overflow-y-auto">
        {Object.entries(LETTER_GROUPS).map(([group, { hint }]) => {
          const members = letters.data?.filter(
            (l) => l.group === Number(group),
          );
          if (!members?.length) return null;
          return (
            <div key={group} className="mt-3">
              <h3 className="text-sm font-semibold text-ink-2">{hint}</h3>
              <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
                {members.map((l) => (
                  <li
                    key={l.id}
                    className="rounded-control bg-sheet px-2 py-2 text-center shadow-card"
                  >
                    <p lang="ru" className="font-serif text-2xl font-semibold">
                      {l.text}{" "}
                      <span className="font-normal text-ink-2">
                        {l.text.toLowerCase()}
                      </span>
                    </p>
                    <p className="text-sm text-ink-2">{l.pronunciation}</p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
