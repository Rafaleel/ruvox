import { useMutation } from "@tanstack/react-query";
import { Smartphone } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiError, pairLan } from "./api/client";
import { Button } from "./components/Button";
import { friendlyError } from "./components/ErrorMessage";
import { Field } from "./components/Field";
import { Icon } from "./components/Icon";
import { Notice } from "./components/Notice";

const CODE_LENGTH = 6;

/** Full-screen gate shown on a phone that has not been paired yet. */
export function Pairing() {
  const [code, setCode] = useState("");
  const pair = useMutation({
    mutationFn: pairLan,
    // The cookie is set: reload so every request starts authenticated.
    onSuccess: () => window.location.reload(),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length === CODE_LENGTH) pair.mutate(code);
  };
  const error = pair.error;

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md content-center px-5 py-8">
      <div className="rise rounded-hero bg-sheet p-6 shadow-card sm:p-8">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-soft text-gold-ink"
          >
            <Icon icon={Smartphone} size={22} />
          </span>
          <h1 className="text-display leading-none tracking-tight">Ruvox</h1>
        </div>
        <p className="mt-5 font-serif text-h3 leading-snug font-semibold">
          Pareie este celular com o seu computador.
        </p>
        <p className="mt-2 text-ink-2">
          Digite o código de 6 dígitos mostrado no computador (Configurações
          &gt; Acesso pelo celular).
        </p>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          <Field label="Código de pareamento">
            {(control) => (
              <input
                {...control}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                pattern="[0-9]*"
                placeholder="000000"
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH),
                  )
                }
                className="min-h-16 w-full rounded-control border border-rule bg-sheet-2 px-3.5 indent-[0.3em] text-center font-serif text-4xl font-semibold tracking-[0.3em] text-ink tabular-nums transition-colors placeholder:text-ink-3/60"
              />
            )}
          </Field>
          <Button
            type="submit"
            size="lg"
            disabled={code.length !== CODE_LENGTH}
            loading={pair.isPending}
          >
            {pair.isPending ? "Pareando…" : "Parear"}
          </Button>
        </form>
        <div aria-live="polite" className="empty:hidden mt-4">
          {error && (
            <Notice tone="danger">
              {error instanceof ApiError && error.status === 403
                ? "Código incorreto."
                : friendlyError(error)}
            </Notice>
          )}
        </div>
      </div>
    </main>
  );
}
