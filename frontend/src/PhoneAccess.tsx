import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Unplug } from "lucide-react";
import { useEffect, useId, useState } from "react";
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
import { ErrorMessage, friendlyError } from "./components/ErrorMessage";
import { Notice } from "./components/Notice";
import { Section } from "./components/Section";
import { Switch } from "./components/Switch";

const RESTART_DELAY_MS = 2000;
const POLL_MS = 1000;
const GIVE_UP_MS = 30000;

const TITLE = "Acesso pelo celular";
const INTRO = "Use o Ruvox no celular, na mesma rede Wi-Fi do computador.";

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
  const switchLabel = useId();
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
      <Section title={TITLE} description={INTRO}>
        <ErrorMessage error={lan.error} onRetry={() => lan.refetch()} />
      </Section>
    );
  if (!lan.data) return null;

  const { enabled, running, urls, code } = lan.data;
  const mutationError = toggle.error ?? renew.error ?? unpair.error;
  const busy = toggle.isPending || restarting;

  return (
    <Section title={TITLE} description={INTRO}>
      <Card className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p id={switchLabel} className="font-semibold">
              Permitir acesso pelo celular
            </p>
            <p className="text-sm text-ink-3">
              {enabled ? "Ligado" : "Desligado"}. Só quem digitar o código
              consegue entrar.
            </p>
          </div>
          <Switch
            aria-labelledby={switchLabel}
            checked={enabled}
            disabled={busy}
            onCheckedChange={(on) => {
              setNotice("");
              if (on) setWarning(true);
              else toggle.mutate(false);
            }}
          />
        </div>

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

        <div aria-live="polite" className="grid gap-3 empty:hidden">
          {restarting && !timedOut && <Notice>O app vai reiniciar…</Notice>}
          {timedOut && (
            <Notice tone="danger">
              O app não voltou em 30 segundos. Feche e abra o Ruvox de novo.
            </Notice>
          )}
          {!restarting && enabled && !running && (
            <Notice>
              Reinício pendente: o acesso pelo celular liga quando o app
              reiniciar.
            </Notice>
          )}
          {!restarting && !enabled && running && (
            <Notice>
              Reinício pendente: o acesso pelo celular desliga quando o app
              reiniciar.
            </Notice>
          )}
          {notice && <Notice tone="success">{notice}</Notice>}
        </div>

        {running && (
          <div className="grid gap-5 border-t border-hairline pt-5">
            <Notice tone="warning">
              Enquanto estiver ligado, quem estiver pareado pode usar o app e a
              sua chave. Use só em redes em que você confia.
            </Notice>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-ink-2">
                  {urls.length === 1 ? "Endereço" : "Endereços"} para abrir no
                  celular
                </p>
                <ul className="mt-2 grid gap-2">
                  {urls.map((url) => (
                    <li
                      key={url}
                      className="rounded-control bg-sheet-2 px-3.5 py-3 font-medium break-all shadow-[inset_0_0_0_1px_var(--hairline)]"
                    >
                      {url}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-2">
                  Código de pareamento
                </p>
                {code && (
                  <p className="mt-2 rounded-card bg-gold-soft px-4 py-3 text-center font-serif text-5xl font-semibold tracking-[0.18em] text-gold-ink outline-2 -outline-offset-6 outline-gold/50 outline-dashed">
                    <span aria-hidden="true">{code}</span>
                    <span className="sr-only">{code.split("").join(" ")}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <Button
                variant="secondary"
                icon={RefreshCw}
                loading={renew.isPending}
                onClick={() => renew.mutate()}
              >
                Renovar código
              </Button>
              <Button
                variant="secondary"
                icon={Unplug}
                onClick={() => setConfirmUnpair(true)}
              >
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
          <Notice tone="danger">{friendlyError(mutationError)}</Notice>
        )}
      </Card>
    </Section>
  );
}
