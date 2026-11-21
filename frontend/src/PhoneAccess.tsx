import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, RefreshCw, Unplug } from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  ApiError,
  getLan,
  health,
  renewLanCode,
  setLan,
  unpairAll,
} from "./api/client";
import { StampFrame } from "./components/art/StampFrame";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { ConfirmPanel } from "./components/ConfirmPanel";
import { ErrorMessage, friendlyError } from "./components/ErrorMessage";
import { Icon } from "./components/Icon";
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

/** An address as a chip: click to copy it (the text stays selectable as a fallback). */
function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // No clipboard permission: the address can still be selected by hand.
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copiar endereço"
      className="group flex w-full items-center justify-between gap-3 rounded-full bg-sheet-2 py-2 pr-2 pl-4 text-left font-medium break-all shadow-[inset_0_0_0_1px_var(--hairline)] transition-[transform,background-color] duration-150 ease-out-soft hover:bg-sheet active:scale-[.98]"
    >
      <span>{text}</span>
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-sheet px-2.5 py-1 text-xs font-semibold text-ink-2 shadow-card">
        <Icon icon={copied ? Check : Copy} size={14} />
        <span aria-live="polite">{copied ? "Copiado" : "Copiar"}</span>
      </span>
    </button>
  );
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
      <Card className="@container grid gap-4">
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
            <div className="grid items-center gap-6 @[40rem]:grid-cols-[auto_minmax(0,1fr)] @[40rem]:gap-8">
              <div>
                <p className="text-sm font-semibold text-ink-2">
                  Código de pareamento
                </p>
                {code && (
                  <StampFrame className="stamp-in mt-2 px-8 py-5 text-center">
                    <p className="font-serif text-[clamp(2.5rem,9cqw,3.75rem)] leading-none font-semibold tracking-[0.14em] indent-[0.14em] text-gold-ink">
                      <span aria-hidden="true">{code}</span>
                      <span className="sr-only">
                        {code.split("").join(" ")}
                      </span>
                    </p>
                  </StampFrame>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-2">
                  {urls.length === 1 ? "Endereço" : "Endereços"} para abrir no
                  celular
                </p>
                <ul className="mt-2 grid gap-2">
                  {urls.map((url) => (
                    <li key={url}>
                      <CopyChip text={url} />
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-ink-3">
                  Digite o endereço no navegador do celular e depois o código.
                </p>
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
