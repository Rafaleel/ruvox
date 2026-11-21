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
import { StampFrame } from "./components/art/StampFrame";
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
      <StampFrame className="stamp-in flex w-fit items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold">
        <Icon icon={CircleCheck} size={16} />
        Em uso
      </StampFrame>
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

/** Monogram tiles: simple letters on token colors, never a trademarked logo. */
const marks: Record<string, string> = {
  anthropic: "bg-accent-soft text-accent",
  openai: "bg-success-soft text-success",
  groq: "bg-gold-soft text-gold-ink",
};

/** A numbered step of the notebook-style procedure: key, model, activation. */
function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 border-t border-hairline pt-5 first:border-t-0 first:pt-0">
      <h4 className="flex items-center gap-2.5 text-sm font-semibold tracking-wide uppercase text-ink-2">
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-full bg-sheet-2 font-serif text-sm font-semibold text-ink normal-case"
        >
          {n}
        </span>
        {title}
      </h4>
      {children}
    </div>
  );
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
      {
        onSuccess: () => {
          setKeyDraft("");
          // A refusal of the old, mistyped key no longer applies.
          if (models.isError) models.reset();
        },
      },
    );
  };
  const removeKey = () => {
    setConfirmRemove(false);
    test.reset();
    save.mutate(
      { providers: { [id]: { api_key: "" } } },
      {
        onSuccess: () => {
          models.reset();
          setChosen("");
        },
      },
    );
  };

  const hint = needs ?? (active ? "Esta é a IA usada nas sessões." : null);

  return (
    <Card
      margin={active}
      className={`rise @container relative overflow-hidden p-0 ${active ? "shadow-[0_0_0_1.5px_var(--gold),var(--card-shadow)]" : ""}`}
      style={stagger(index)}
    >
      <section
        aria-labelledby={titleId}
        className="grid @[46rem]:grid-cols-[15rem_minmax(0,1fr)]"
      >
        <header
          className={`relative flex flex-col gap-3 overflow-hidden p-5 @[46rem]:p-6 ${active ? "bg-gold-soft/50" : "bg-sheet-2/60"}`}
        >
          <span
            aria-hidden="true"
            className={`grid size-14 place-items-center rounded-[1.1rem] font-serif text-3xl leading-none font-semibold shadow-[inset_0_0_0_1px_var(--hairline)] ${marks[id] ?? marks.groq}`}
          >
            {maker.charAt(0)}
          </span>
          <div>
            {label !== maker && (
              <p className="text-sm font-semibold tracking-wide text-accent">
                {label}
              </p>
            )}
            <h3
              id={titleId}
              className="text-[clamp(1.75rem,5cqw,2.25rem)] leading-none tracking-tight"
            >
              {maker}
            </h3>
          </div>
          <div className="@[46rem]:mt-auto">
            <StatusBadge provider={provider} active={active} />
          </div>
        </header>

        <div
          className={`grid content-start gap-5 p-5 @[46rem]:p-6 ${active ? "margin-rule pl-9 @[46rem]:pl-9" : ""}`}
        >
          <Step n={1} title="Chave">
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
                  A chave vem de uma variável de ambiente e não pode ser
                  alterada aqui, mas você pode escolher o modelo.
                </p>
              )}
              <div className="grid gap-2 @[30rem]:flex @[30rem]:flex-wrap">
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
          </Step>

          <Step n={2} title="Modelo">
            <p
              className={
                model
                  ? "w-fit max-w-full rounded-control bg-sheet-2 px-3 py-1.5 font-medium break-all shadow-[inset_0_0_0_1px_var(--hairline)]"
                  : "text-ink-3"
              }
            >
              {model ? `Modelo salvo: ${model}` : "Nenhum modelo escolhido."}
            </p>
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
            <div className="grid gap-2 @[30rem]:flex @[30rem]:flex-wrap">
              <Button
                variant="secondary"
                icon={ListRestart}
                // Only Claude can list models without a key.
                disabled={id !== "anthropic" && !has_key && !keyDraft.trim()}
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
                  onClick={() => {
                    test.reset();
                    patch({ model: selected });
                  }}
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
          </Step>

          {error && <Notice tone="danger">{friendlyError(error)}</Notice>}

          <Step n={3} title="Ativação">
            <div className="grid gap-2 @[30rem]:flex @[30rem]:flex-wrap @[30rem]:items-center @[30rem]:gap-x-3">
              {!active && (
                <Button
                  variant={needs ? "secondary" : "primary"}
                  icon={Sparkles}
                  disabled={!!needs || save.isPending}
                  loading={saving("active")}
                  onClick={() => {
                    test.reset();
                    save.mutate({ active_provider: id });
                  }}
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
            </div>
            {hint && (
              <p
                className={
                  needs
                    ? "text-sm text-ink-2"
                    : "text-sm font-medium text-gold-ink"
                }
              >
                {hint}
              </p>
            )}
            <div aria-live="polite" className="empty:hidden">
              {test.data && (
                <Notice tone={test.data.ok ? "success" : "danger"}>
                  {test.data.message}
                </Notice>
              )}
              {test.isError && (
                <Notice tone="danger">{friendlyError(test.error)}</Notice>
              )}
            </div>
          </Step>
        </div>
      </section>
    </Card>
  );
}
