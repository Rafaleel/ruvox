import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ApiError,
  getLan,
  health,
  renewLanCode,
  setLan,
  unpairAll,
} from "./api/client";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { ConfirmPanel } from "./components/ConfirmPanel";
import { ErrorMessage } from "./components/ErrorMessage";

const RESTART_DELAY_MS = 2000;
const POLL_MS = 1000;
const GIVE_UP_MS = 30000;

/** After the toggle the backend exits and the shell respawns it: reload once it answers. */
function useReloadWhenBack(active: boolean) {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!active) return;
    setTimedOut(false);
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      if (Date.now() - started > GIVE_UP_MS) {
        setTimedOut(true);
        return;
      }
      try {
        if ((await health()).status === "ok") {
          if (!stopped) window.location.reload();
          return;
        }
      } catch {
        // Still restarting.
      }
      timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, RESTART_DELAY_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active]);
  return timedOut;
}

export function PhoneAccess() {
  const queryClient = useQueryClient();
  const [restarting, setRestarting] = useState(false);
  const lan = useQuery({
    queryKey: ["lan"],
    queryFn: ({ signal }) => getLan(signal),
    retry: false,
    // The code changes when a phone pairs.
    refetchInterval: (query) =>
      query.state.data?.running && !restarting ? 5000 : false,
  });
  const [warning, setWarning] = useState(false);
  const [confirmUnpair, setConfirmUnpair] = useState(false);
  const [notice, setNotice] = useState("");
  const timedOut = useReloadWhenBack(restarting);

  const toggle = useMutation({
    mutationFn: setLan,
    onSuccess: (data) => {
      queryClient.setQueryData(["lan"], data);
      setWarning(false);
      setRestarting(data.enabled !== data.running);
    },
  });
  const renew = useMutation({
    mutationFn: renewLanCode,
    onSuccess: ({ code }) => {
      queryClient.setQueryData(
        ["lan"],
        (old: typeof lan.data) => old && { ...old, code },
      );
      setNotice("Código renovado.");
    },
  });
  const unpair = useMutation({
    mutationFn: unpairAll,
    onSuccess: () => {
      setConfirmUnpair(false);
      setNotice("Todos os celulares foram desconectados.");
      return lan.refetch();
    },
  });

  // Opened from a phone: only the desktop manages phone access.
  if (lan.error instanceof ApiError && lan.error.status === 403) return null;
  // Keep the card (and its restart message) if a refetch fails mid-restart.
  if (lan.isError && !lan.data)
    return (
      <Card className="mt-4">
        <h2 className="text-xl font-bold">Acesso pelo celular</h2>
        <div className="mt-3">
          <ErrorMessage error={lan.error} onRetry={() => lan.refetch()} />
        </div>
      </Card>
    );
  if (!lan.data) return null;

  const { enabled, running, urls, code } = lan.data;
  const mutationError = toggle.error ?? renew.error ?? unpair.error;
  const busy = toggle.isPending || restarting;

  return (
    <Card className="mt-4">
      <h2 className="text-xl font-bold">Acesso pelo celular</h2>
      <label className="mt-3 flex min-h-11 items-center gap-3 font-semibold">
        <input
          type="checkbox"
          role="switch"
          className="size-6 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          checked={enabled}
          disabled={busy}
          onChange={(e) => {
            setNotice("");
            if (e.target.checked) setWarning(true);
            else toggle.mutate(false);
          }}
        />
        Permitir acesso pelo celular
      </label>

      {warning && !enabled && (
        <ConfirmPanel
          title="Antes de ativar"
          confirmLabel="Ativar acesso"
          busy={toggle.isPending}
          onConfirm={() => toggle.mutate(true)}
          onCancel={() => setWarning(false)}
        >
          <p>
            Quem for pareado poderá usar o app, inclusive a chave da API
            configurada. Ative só em redes em que você confia.
          </p>
        </ConfirmPanel>
      )}

      <div aria-live="polite" className="mt-3">
        {restarting && !timedOut && <p>O app vai reiniciar…</p>}
        {timedOut && (
          <p className="text-danger">
            O app não voltou em 30 segundos. Feche e abra o Ruvox de novo.
          </p>
        )}
        {!restarting && enabled && !running && (
          <p>
            Reinício pendente: o acesso pelo celular liga quando o app
            reiniciar.
          </p>
        )}
        {!restarting && !enabled && running && (
          <p>
            Reinício pendente: o acesso pelo celular desliga quando o app
            reiniciar.
          </p>
        )}
        {notice && <p className="text-success">{notice}</p>}
      </div>

      {running && (
        <div className="mt-3 grid gap-3">
          <div>
            <p className="font-semibold">
              {urls.length === 1 ? "Endereço" : "Endereços"} para abrir no
              celular
            </p>
            <ul className="break-all">
              {urls.map((url) => (
                <li key={url}>{url}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold">Código de pareamento</p>
            {code && (
              <p className="text-5xl font-extrabold tracking-[0.2em]">
                <span aria-hidden="true">{code}</span>
                <span className="sr-only">{code.split("").join(" ")}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={renew.isPending}
              onClick={() => renew.mutate()}
            >
              Renovar código
            </Button>
            <Button variant="secondary" onClick={() => setConfirmUnpair(true)}>
              Desparear todos os celulares
            </Button>
          </div>
          {confirmUnpair && (
            <ConfirmPanel
              title="Desparear todos os celulares?"
              confirmLabel="Desparear todos"
              busy={unpair.isPending}
              onConfirm={() => unpair.mutate()}
              onCancel={() => setConfirmUnpair(false)}
            >
              <p>
                Todos os celulares pareados perdem o acesso e precisam digitar
                um novo código.
              </p>
            </ConfirmPanel>
          )}
        </div>
      )}

      {mutationError && (
        <p role="alert" className="mt-3 text-danger">
          {mutationError instanceof ApiError
            ? mutationError.message
            : "Algo deu errado. Tente de novo."}
        </p>
      )}
    </Card>
  );
}
