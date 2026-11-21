import { useQuery } from "@tanstack/react-query";
import { Cpu, Database, ShieldCheck, Smartphone } from "lucide-react";
import { getLan, getSettings } from "./api/client";
import { GhostLetter } from "./components/art/GhostLetter";
import { ErrorMessage } from "./components/ErrorMessage";
import { Icon } from "./components/Icon";
import { stagger } from "./components/motion";
import { Notice } from "./components/Notice";
import { PageHeader } from "./components/PageHeader";
import { Section } from "./components/Section";
import { PhoneAccess } from "./PhoneAccess";
import { missingStep, ProviderCard } from "./ProviderCard";
import { YourData } from "./YourData";

const link =
  "group flex items-center gap-3 rounded-control px-3 py-2 font-medium text-ink-2 transition-colors hover:bg-sheet hover:text-ink";

/** Section index beside the content on wide windows; a row of chips on narrow ones. */
function Index({ phone }: { phone: boolean }) {
  const items = [
    { href: "#ia", label: "Inteligência artificial", icon: Cpu },
    ...(phone
      ? [{ href: "#celular", label: "Acesso pelo celular", icon: Smartphone }]
      : []),
    { href: "#dados", label: "Seus dados", icon: Database },
  ];
  return (
    <nav
      aria-label="Seções das configurações"
      className="rise sticky top-4 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-card bg-paper/85 p-1 backdrop-blur min-[64rem]:top-8 min-[64rem]:mx-0 min-[64rem]:grid min-[64rem]:self-start min-[64rem]:overflow-visible min-[64rem]:bg-transparent min-[64rem]:p-0 min-[64rem]:backdrop-blur-none"
      style={stagger(1)}
    >
      {items.map(({ href, label, icon }) => (
        <a key={href} href={href} className={`${link} shrink-0`}>
          <Icon icon={icon} className="text-ink-3 group-hover:text-accent" />
          {label}
        </a>
      ))}
    </nav>
  );
}

export function Settings() {
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: ({ signal }) => getSettings(signal),
    retry: false,
  });
  // Shares the cache with PhoneAccess: the index only lists the section when it shows.
  const lan = useQuery({
    queryKey: ["lan"],
    queryFn: ({ signal }) => getLan(signal),
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
      <div className="mt-6 grid gap-6 min-[64rem]:mt-10 min-[64rem]:grid-cols-[13.5rem_minmax(0,1fr)] min-[64rem]:gap-12">
        <Index phone={!!lan.data} />
        <div className="grid min-w-0 gap-14">
          <div id="ia" className="scroll-mt-20">
            <Section
              title="Inteligência artificial"
              description="Com uma IA, o Ruvox cria perguntas e explicações com mais variedade."
            >
              <div
                className="rise relative flex gap-3 overflow-hidden rounded-card bg-sheet p-4 shadow-card"
                style={stagger(1)}
              >
                <GhostLetter letter="И" className="-right-4 -bottom-8 w-32" />
                <Icon
                  icon={ShieldCheck}
                  className="relative mt-0.5 shrink-0 text-success"
                />
                <p className="relative max-w-prose text-ink">
                  O Ruvox funciona offline, sem nenhuma chave: letras, palavras
                  e treino não precisam de IA. Se você conectar uma, a chave
                  fica só neste computador e nunca é mostrada de volta.
                </p>
              </div>
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
                    <Notice tone="success" title="IA pronta">
                      Nas sessões o app usa {active.maker} ({active.model}).
                    </Notice>
                  ) : (
                    <Notice tone="warning" title="Modo offline por enquanto">
                      {needs}.
                    </Notice>
                  )}
                  <div className="grid gap-5">
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
          </div>
          <div id="celular" className="scroll-mt-20 empty:hidden">
            <PhoneAccess />
          </div>
          <div id="dados" className="scroll-mt-20">
            <YourData />
          </div>
        </div>
      </div>
    </>
  );
}
