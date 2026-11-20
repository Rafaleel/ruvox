import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ApiError, pairLan } from "./api/client";
import { Button } from "./components/Button";
import { friendlyError } from "./components/ErrorMessage";

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
    <main className="mx-auto grid min-h-dvh w-full max-w-md content-center gap-4 px-5 py-8">
      <h1 className="text-5xl font-extrabold tracking-tighter">Ruvox</h1>
      <p className="text-xl">Pareie este celular com o seu computador.</p>
      <p>
        Digite o código de 6 dígitos mostrado no computador (Configurações &gt;
        Acesso pelo celular).
      </p>
      <form onSubmit={submit} className="grid gap-3">
        <label className="font-semibold">
          Código de pareamento
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            pattern="[0-9]*"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
            }
            className="mt-1 min-h-14 w-full rounded-lg border border-line bg-paper px-3 text-center text-3xl font-extrabold tracking-[0.3em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>
        <Button
          type="submit"
          className="min-h-14 text-xl"
          disabled={code.length !== CODE_LENGTH || pair.isPending}
        >
          {pair.isPending ? "Pareando…" : "Parear"}
        </Button>
      </form>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="text-danger">
            {error instanceof ApiError && error.status === 403
              ? "Código incorreto."
              : friendlyError(error)}
          </p>
        )}
      </div>
    </main>
  );
}
