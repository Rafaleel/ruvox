import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleCheck,
  ExternalLink,
  KeyRound,
  ListRestart,
  Plug,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import {
  listProviderModels,
  putSettings,
  testProvider,
  type Provider,
  type SettingsUpdate,
} from "./api/client";
import { Badge } from "./components/Badge";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { ConfirmPanel } from "./components/ConfirmPanel";
import { friendlyError } from "./components/ErrorMessage";
import { Input, Select } from "./components/Field";
import { Icon } from "./components/Icon";
import { stagger } from "./components/motion";
import { Notice } from "./components/Notice";

/** Why this provider cannot be used yet, or null when it can. */
export function missingStep({ has_key, model, label, maker }: Provider) {
  if (!has_key) return `Salve a chave da ${label} para usar o ${maker}`;
  if (!model) return `Escolha um modelo para usar o ${maker}`;
  return null;
}

function StatusBadge({
  provider,
  active,
}: {
  provider: Provider;
  active: boolean;
}) {
  if (active)
    return (
      <Badge
        tone={missingStep(provider) ? "gold" : "success"}
        icon={CircleCheck}
      >
        Em uso
      </Badge>
    );
  if (provider.key_from_env)
    return <Badge icon={KeyRound}>Chave da variável de ambiente</Badge>;
  if (provider.has_key)
    return (
      <Badge tone="success" icon={KeyRound}>
        Chave salva
      </Badge>
    );
  return <Badge>Sem chave</Badge>;
}

const optionText = (m: { id: string; label: string }) =>
  m.label === m.id ? m.id : `${m.label} (${m.id})`;

/** One AI provider: its key, the model chosen from the provider's own list, and whether it is in use. */
export function ProviderCard({
  provider,
  active,
  index,
}: {
  provider: Provider;
  active: boolean;
  index: number;
}) {
  const { id, label, maker, has_key, key_from_env, model } = provider;
  const queryClient = useQueryClient();
  const titleId = useId();
  const [keyDraft, setKeyDraft] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [chosen, setChosen] = useState("");

  const save = useMutation({
    mutationFn: (body: SettingsUpdate) => putSettings(body),
    onSuccess: (data) => queryClient.setQueryData(["settings"], data),
  });
  const models = useMutation({
    mutationFn: () => listProviderModels(id, keyDraft.trim()),
    onSuccess: () => setChosen(""),
  });
  // Claude ids are published, so their list shows before a key exists (no network call).
  const builtin = useQuery({
    queryKey: ["provider-models", id, "builtin"],
    queryFn: () => listProviderModels(id),
    enabled: id === "anthropic" && !has_key,
    retry: false,
    staleTime: Infinity,
  });
  const test = useMutation({ mutationFn: () => testProvider(id) });

  const list = models.data ?? (has_key ? undefined : builtin.data);
  const selected =
    chosen || (list?.models.some((m) => m.id === model) ? model : "");
  const needs = missingStep(provider);
  const error = save.error ?? models.error ?? builtin.error;
  const saving = (field: "api_key" | "model" | "active") =>
    save.isPending &&
    (field === "active"
      ? save.variables?.active_provider !== undefined
      : save.variables?.providers?.[id]?.[field] !== undefined);

  const patch = (change: { api_key?: string; model?: string }) =>
    save.mutate({ providers: { [id]: change } });

  const saveKey = (e: FormEvent) => {
    e.preventDefault();
    const key = keyDraft.trim();
    if (!key) return;
    test.reset();
    save.mutate(
      { providers: { [id]: { api_key: key } } },
      { onSuccess: () => setKeyDraft("") },
    );
  };
  const removeKey = () => {
    setConfirmRemove(false);
    test.reset();
    save.mutate(
      { providers: { [id]: { api_key: "" } } },
      { onSuccess: () => models.reset() },
    );
  };

  const hint = needs ?? (active ? "Esta é a IA usada nas sessões." : null);

  return (
    <Card margin={active} className="rise" style={stagger(index)}>
      <section aria-labelledby={titleId} className="grid gap-5">
        <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div>
            {label !== maker && (
              <p className="text-sm font-semibold tracking-wide text-accent">
                {label}
              </p>
            )}
            <h3 id={titleId} className="text-h2">
              {maker}
            </h3>
          </div>
          <StatusBadge provider={provider} active={active} />
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <form onSubmit={saveKey} className="grid content-start gap-3">
            <Input
              label={`Chave da API da ${label}`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={provider.key_example}
              value={keyDraft}
              disabled={key_from_env}
              onChange={(e) => setKeyDraft(e.target.value)}
              help={
                <>
                  {has_key
                    ? "Há uma chave salva neste computador. Digite outra para trocar. "
                    : "Fica só neste computador. "}
                  <a
                    href={provider.key_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-accent underline underline-offset-2"
                  >
                    Criar chave
                    <span className="sr-only">
                      {" "}
                      da {label} (abre em nova aba)
                    </span>
                    <Icon icon={ExternalLink} size={14} />
                  </a>
                </>
              }
            />
            {key_from_env && (
              <p className="text-sm text-ink-2">
                A chave vem de uma variável de ambiente e não pode ser alterada
                aqui, mas você pode escolher o modelo.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={key_from_env || !keyDraft.trim() || save.isPending}
                loading={saving("api_key") && keyDraft !== ""}
              >
                Salvar chave
              </Button>
              <Button
                variant="ghost"
                icon={Trash2}
                disabled={key_from_env || !has_key || save.isPending}
                onClick={() => setConfirmRemove(true)}
              >
                Remover chave
              </Button>
            </div>
            {confirmRemove && (
              <ConfirmPanel
                title={`Remover a chave da ${label}?`}
                confirmLabel="Sim, remover"
                busy={save.isPending}
                onConfirm={removeKey}
                onCancel={() => setConfirmRemove(false)}
              >
                <p>
                  O Ruvox deixa de usar o {maker} até você salvar outra chave.
                </p>
              </ConfirmPanel>
            )}
          </form>

          <div className="grid content-start gap-3 md:border-l md:border-hairline md:pl-6">
            <div>
              <h4 className="text-sm font-semibold">Modelo</h4>
              <p className="text-ink-2">
                {model ? `Modelo salvo: ${model}` : "Nenhum modelo escolhido."}
              </p>
            </div>
            {list && (
              <Select
                label="Modelos disponíveis"
                value={selected}
                onChange={(e) => setChosen(e.target.value)}
                help={
                  list.source === "builtin"
                    ? "Lista padrão; com a chave mostramos os modelos da sua conta."
                    : `${list.models.length} ${list.models.length === 1 ? "modelo" : "modelos"} da sua conta.`
                }
              >
                {!selected && (
                  <option value="" disabled>
                    Escolha um modelo
                  </option>
                )}
                {list.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {optionText(m)}
                  </option>
                ))}
              </Select>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                icon={ListRestart}
                loading={models.isPending}
                onClick={() => models.mutate()}
              >
                {models.isPending
                  ? "Buscando modelos…"
                  : "Carregar modelos disponíveis"}
              </Button>
              {list && (
                <Button
                  disabled={!selected || selected === model || save.isPending}
                  loading={saving("model")}
                  onClick={() => patch({ model: selected })}
                >
                  Usar este modelo
                </Button>
              )}
            </div>
            {!list && (
              <p className="text-sm text-ink-3">
                Você escolhe o modelo numa lista da própria {label}, sem
                digitar.
              </p>
            )}
          </div>
        </div>

        {error && <Notice tone="danger">{friendlyError(error)}</Notice>}

        <footer className="grid gap-3 border-t border-hairline pt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {!active && (
              <Button
                variant={needs ? "secondary" : "primary"}
                icon={Sparkles}
                disabled={!!needs || save.isPending}
                loading={saving("active")}
                onClick={() => save.mutate({ active_provider: id })}
              >
                Usar esta IA nas sessões
              </Button>
            )}
            <Button
              variant="secondary"
              icon={Plug}
              disabled={!!needs}
              loading={test.isPending}
              onClick={() => test.mutate()}
            >
              Testar conexão
            </Button>
            {hint && <p className="text-sm text-ink-2">{hint}</p>}
          </div>
          <div aria-live="polite">
            {test.data && (
              <Notice tone={test.data.ok ? "success" : "danger"}>
                {test.data.message}
              </Notice>
            )}
            {test.isError && (
              <Notice tone="danger">{friendlyError(test.error)}</Notice>
            )}
          </div>
        </footer>
      </section>
    </Card>
  );
}
