import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { getSettings, putSettings, testLlm } from "./api/client";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { ErrorMessage } from "./components/ErrorMessage";
import { PhoneAccess } from "./PhoneAccess";
import { YourData } from "./YourData";

const inputClass =
  "mt-1 min-h-11 w-full rounded-lg border border-line bg-paper px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50";

export function Settings() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: ({ signal }) => getSettings(signal),
    retry: false,
  });
  const [apiKey, setApiKey] = useState("");
  // null until edited, so the field follows the saved model.
  const [modelDraft, setModelDraft] = useState<string | null>(null);

  const test = useMutation({ mutationFn: testLlm });
  const save = useMutation({
    mutationFn: putSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      setApiKey("");
      setModelDraft(null);
      test.reset();
    },
  });

  if (settings.isError)
    return (
      <ErrorMessage error={settings.error} onRetry={() => settings.refetch()} />
    );
  if (!settings.data) return <p role="status">Carregando…</p>;

  const { has_key, key_from_env, model } = settings.data;
  const modelValue = modelDraft ?? model;

  const saveKey = (e: FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) save.mutate({ api_key: apiKey });
  };
  const saveModel = (e: FormEvent) => {
    e.preventDefault();
    if (modelValue.trim()) save.mutate({ model: modelValue });
  };

  return (
    <>
      <h1 className="text-3xl font-extrabold">Configurações</h1>

      <Card className="mt-6">
        <h2 className="text-xl font-bold">Chave da API</h2>
        <p className="mt-2">
          {has_key ? "Chave configurada." : "Nenhuma chave configurada."}
        </p>
        {key_from_env && (
          <p className="mt-1 text-muted">
            A chave vem da variável de ambiente ANTHROPIC_API_KEY e não pode ser
            alterada aqui.
          </p>
        )}
        {!has_key && (
          <p className="mt-2 rounded-lg border border-line p-3">
            Sem chave da API: o app funciona em modo offline (letras, palavras e
            treino sem IA).
          </p>
        )}
        <form onSubmit={saveKey} className="mt-4">
          <label className="font-semibold">
            Nova chave da API
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              disabled={key_from_env}
              onChange={(e) => setApiKey(e.target.value)}
              className={inputClass}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={key_from_env || !apiKey.trim() || save.isPending}
            >
              Salvar chave
            </Button>
            <Button
              variant="secondary"
              disabled={key_from_env || !has_key || save.isPending}
              onClick={() => save.mutate({ api_key: "" })}
            >
              Remover chave
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-4">
        <h2 className="text-xl font-bold">Modelo</h2>
        <form onSubmit={saveModel} className="mt-2">
          <label className="font-semibold">
            Nome do modelo
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={modelValue}
              onChange={(e) => setModelDraft(e.target.value)}
              className={inputClass}
            />
          </label>
          <Button
            type="submit"
            className="mt-3"
            disabled={
              !modelValue.trim() || modelValue === model || save.isPending
            }
          >
            Salvar modelo
          </Button>
        </form>
      </Card>

      {save.isError && (
        <div className="mt-4">
          <ErrorMessage
            error={save.error}
            onRetry={() => save.mutate(save.variables!)}
          />
        </div>
      )}

      <Card className="mt-4">
        <h2 className="text-xl font-bold">Conexão</h2>
        <Button
          variant="secondary"
          className="mt-2"
          disabled={test.isPending}
          onClick={() => test.mutate()}
        >
          {test.isPending ? "Testando…" : "Testar conexão"}
        </Button>
        <div aria-live="polite" className="mt-3">
          {test.data && (
            <p className={test.data.ok ? "text-success" : "text-danger"}>
              {test.data.message}
            </p>
          )}
          {test.isError && (
            <p className="text-danger">
              Não foi possível falar com o serviço local.
            </p>
          )}
        </div>
      </Card>

      <PhoneAccess />
      <YourData />
    </>
  );
}
