import { useQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { getSettings } from "./api/client";
import { Badge } from "./components/Badge";
import { ErrorMessage } from "./components/ErrorMessage";
import { PageHeader } from "./components/PageHeader";
import { Notice } from "./components/Notice";
import { Section } from "./components/Section";
import { PhoneAccess } from "./PhoneAccess";
import { missingStep, ProviderCard } from "./ProviderCard";
import { YourData } from "./YourData";

export function Settings() {
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: ({ signal }) => getSettings(signal),
    retry: false,
  });

  const data = settings.data;
  const active = data?.providers.find((p) => p.id === data.active_provider);
  const needs = active && missingStep(active);

  return (
    <>
      <PageHeader
        eyebrow="Ajustes"
        title="Configurações"
        description="Escolha a inteligência artificial das sessões e cuide do acesso pelo celular e dos seus dados."
      />
      <div className="mt-8 grid gap-12">
        <Section
          title="Inteligência artificial"
          description="Com uma IA, o Ruvox cria perguntas e explicações com mais variedade."
        >
          <Notice>
            O Ruvox funciona offline, sem nenhuma chave: letras, palavras e
            treino não precisam de IA. Se você conectar uma, a chave fica só
            neste computador e nunca é mostrada de volta.
          </Notice>
          {settings.isPending && <p className="text-ink-2">Carregando…</p>}
          {settings.isError && (
            <ErrorMessage
              error={settings.error}
              onRetry={() => settings.refetch()}
            />
          )}
          {data && active && (
            <>
              {data.llm_ready ? (
                <p className="flex flex-wrap items-center gap-2 text-ink-2">
                  <Badge tone="success" icon={CircleCheck}>
                    IA pronta
                  </Badge>
                  Nas sessões o app usa {active.maker} ({active.model}).
                </p>
              ) : (
                <Notice tone="warning" title="Modo offline por enquanto">
                  {needs}.
                </Notice>
              )}
              <div className="grid gap-4">
                {data.providers.map((provider, i) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    active={provider.id === data.active_provider}
                    index={i}
                  />
                ))}
              </div>
            </>
          )}
        </Section>
        <PhoneAccess />
        <YourData />
      </div>
    </>
  );
}
