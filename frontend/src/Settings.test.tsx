import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Settings } from "./Settings";
import { renderWithProviders } from "./test-utils";

const BASE = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    maker: "Claude",
    key_url: "https://console.anthropic.com/settings/keys",
    key_example: "sk-ant-...",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    maker: "ChatGPT",
    key_url: "https://platform.openai.com/api-keys",
    key_example: "sk-...",
  },
  groq: {
    id: "groq",
    label: "Groq",
    maker: "Groq",
    key_url: "https://console.groq.com/keys",
    key_example: "gsk_...",
  },
};

type Extra = { has_key?: boolean; key_from_env?: boolean; model?: string };

/** The settings answer; `extra` overrides fields per provider id. */
const state = (
  extra: Record<string, Extra> = {},
  active = "anthropic",
  ready = false,
) => ({
  active_provider: active,
  llm_ready: ready,
  providers: Object.values(BASE).map((p) => ({
    has_key: false,
    key_from_env: false,
    model: p.id === "anthropic" ? "claude-sonnet-5-5" : "",
    ...p,
    ...extra[p.id],
  })),
});

const builtin = {
  models: [
    { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
  ],
  source: "builtin",
};
const openaiModels = {
  models: [
    { id: "gpt-5", label: "gpt-5" },
    { id: "gpt-5-mini", label: "GPT-5 mini" },
  ],
  source: "live",
};

type Route = (init?: RequestInit) => Response;
let routes: Record<string, Route>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  routes = {
    // Phone access hides itself when the page is not on the desktop.
    "GET /api/lan": () =>
      Response.json({ detail: "Só no computador." }, { status: 403 }),
    "POST /api/settings/providers/anthropic/models": () =>
      Response.json(builtin),
  };
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const route = routes[`${init?.method ?? "GET"} ${url}`];
    if (!route) throw new Error(`unexpected request ${url}`);
    return route(init);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const card = (name: string) => screen.getByRole("region", { name });
const button = (scope: HTMLElement, name: string | RegExp) =>
  within(scope).getByRole("button", { name }) as HTMLButtonElement;
const bodies = (method: string, url: string) =>
  fetchMock.mock.calls
    .filter(([u, i]) => u === url && i?.method === method)
    .map(([, i]) => JSON.parse(i.body));
const puts = () => bodies("PUT", "/api/settings");
const modelsUrl = (id: string) => `/api/settings/providers/${id}/models`;

it("shows one card per AI, each named by its assistant and company", async () => {
  routes["GET /api/settings"] = () => Response.json(state());
  renderWithProviders(<Settings />);
  await screen.findByRole("region", { name: "ChatGPT" });

  for (const [maker, label] of [
    ["Claude", "Anthropic"],
    ["ChatGPT", "OpenAI"],
    ["Groq", "Groq"],
  ]) {
    const scope = card(maker);
    const key = within(scope).getByLabelText(
      `Chave da API da ${label}`,
    ) as HTMLInputElement;
    expect(key.type).toBe("password");
    expect(key.autocomplete).toBe("off");
  }
  expect(within(card("ChatGPT")).getByPlaceholderText("sk-...")).toBeTruthy();
  const link = within(card("ChatGPT")).getByRole("link", {
    name: /Criar chave/,
  });
  expect(link.getAttribute("href")).toBe(
    "https://platform.openai.com/api-keys",
  );
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noreferrer");
  expect(screen.getByText(/funciona offline, sem nenhuma chave/)).toBeTruthy();
  // Claude is the active one but has no key yet.
  expect(within(card("Claude")).getByText("Em uso")).toBeTruthy();
  expect(within(card("ChatGPT")).getByText("Sem chave")).toBeTruthy();
  expect(
    screen.getAllByText("Salve a chave da Anthropic para usar o Claude").length,
  ).toBeGreaterThan(0);
});

it("saves only that provider's key and never shows it back", async () => {
  let current = state();
  routes["GET /api/settings"] = () => Response.json(current);
  routes["PUT /api/settings"] = () => {
    current = state({ openai: { has_key: true } });
    return Response.json(current);
  };
  renderWithProviders(<Settings />);
  const scope = await screen.findByRole("region", { name: "ChatGPT" });
  const input = within(scope).getByLabelText(
    "Chave da API da OpenAI",
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { value: "sk-secret" } });
  fireEvent.click(button(scope, "Salvar chave"));

  expect(await within(scope).findByText("Chave salva")).toBeTruthy();
  expect(puts()).toEqual([{ providers: { openai: { api_key: "sk-secret" } } }]);
  expect(input.value).toBe("");
  expect(screen.queryByDisplayValue("sk-secret")).toBeNull();
  expect(screen.queryByText(/sk-secret/)).toBeNull();
  expect(within(card("Groq")).getByText("Sem chave")).toBeTruthy();
});

it("removes a key only after confirming, sending an empty string", async () => {
  let current = state({ groq: { has_key: true } });
  routes["GET /api/settings"] = () => Response.json(current);
  routes["PUT /api/settings"] = () => {
    current = state();
    return Response.json(current);
  };
  renderWithProviders(<Settings />);
  const scope = await screen.findByRole("region", { name: "Groq" });
  fireEvent.click(button(scope, "Remover chave"));
  expect(puts()).toHaveLength(0);
  fireEvent.click(button(scope, "Cancelar"));
  expect(within(scope).queryByRole("alertdialog")).toBeNull();

  fireEvent.click(button(scope, "Remover chave"));
  fireEvent.click(button(scope, "Sim, remover"));
  expect(await within(scope).findByText("Sem chave")).toBeTruthy();
  expect(puts()).toEqual([{ providers: { groq: { api_key: "" } } }]);
});

it("lists the built-in Claude models before a key exists", async () => {
  routes["GET /api/settings"] = () => Response.json(state());
  renderWithProviders(<Settings />);
  const scope = await screen.findByRole("region", { name: "Claude" });
  const select = (await within(scope).findByLabelText(
    "Modelos disponíveis",
  )) as HTMLSelectElement;
  expect(select.value).toBe("claude-sonnet-5-5");
  expect([...select.options].map((o) => o.textContent)).toEqual([
    "Claude Opus 5.5 (claude-opus-5-5)",
    "Claude Sonnet 5.5 (claude-sonnet-5-5)",
  ]);
  expect(
    within(scope).getByText(/Lista padrão; com a chave mostramos os modelos/),
  ).toBeTruthy();
  expect(
    within(scope).getByText("Modelo salvo: claude-sonnet-5-5"),
  ).toBeTruthy();
});

it("loads the models with the typed key and saves the chosen one", async () => {
  let current = state({ openai: { has_key: true } });
  routes["GET /api/settings"] = () => Response.json(current);
  routes[`POST ${modelsUrl("openai")}`] = () => Response.json(openaiModels);
  routes["PUT /api/settings"] = (init) => {
    const body = JSON.parse(init!.body as string);
    current = state({
      openai: { has_key: true, model: body.providers.openai.model },
    });
    return Response.json(current);
  };
  renderWithProviders(<Settings />);
  const scope = await screen.findByRole("region", { name: "ChatGPT" });
  expect(within(scope).queryByLabelText("Modelos disponíveis")).toBeNull();
  expect(within(scope).getByText("Nenhum modelo escolhido.")).toBeTruthy();
  expect(button(scope, "Testar conexão").disabled).toBe(true);

  fireEvent.change(within(scope).getByLabelText("Chave da API da OpenAI"), {
    target: { value: " sk-typed " },
  });
  fireEvent.click(button(scope, "Carregar modelos disponíveis"));

  const select = (await within(scope).findByLabelText(
    "Modelos disponíveis",
  )) as HTMLSelectElement;
  expect(bodies("POST", modelsUrl("openai"))).toEqual([
    { api_key: "sk-typed" },
  ]);
  expect([...select.options].map((o) => o.textContent)).toEqual([
    "Escolha um modelo",
    "gpt-5",
    "GPT-5 mini (gpt-5-mini)",
  ]);
  expect(button(scope, "Usar este modelo").disabled).toBe(true);
  // Trying a key does not save it.
  expect(puts()).toHaveLength(0);

  fireEvent.change(select, { target: { value: "gpt-5-mini" } });
  fireEvent.click(button(scope, "Usar este modelo"));
  expect(
    await within(scope).findByText("Modelo salvo: gpt-5-mini"),
  ).toBeTruthy();
  expect(puts()).toEqual([{ providers: { openai: { model: "gpt-5-mini" } } }]);
});

it("loads the models with the saved key when the field is empty", async () => {
  routes["GET /api/settings"] = () =>
    Response.json(state({ groq: { has_key: true } }));
  routes[`POST ${modelsUrl("groq")}`] = () =>
    Response.json({
      models: [{ id: "llama-3.3", label: "llama-3.3" }],
      source: "live",
    });
  renderWithProviders(<Settings />);
  const scope = await screen.findByRole("region", { name: "Groq" });
  fireEvent.click(button(scope, "Carregar modelos disponíveis"));
  expect(
    await within(scope).findByLabelText("Modelos disponíveis"),
  ).toBeTruthy();
  expect(bodies("POST", modelsUrl("groq"))).toEqual([{}]);
});

it("shows the provider's error when the models cannot be loaded", async () => {
  routes["GET /api/settings"] = () => Response.json(state());
  routes[`POST ${modelsUrl("openai")}`] = () =>
    Response.json(
      { detail: "A OpenAI recusou esta chave. Confira se ela está certa." },
      { status: 400 },
    );
  renderWithProviders(<Settings />);
  const scope = await screen.findByRole("region", { name: "ChatGPT" });
  fireEvent.change(within(scope).getByLabelText("Chave da API da OpenAI"), {
    target: { value: "sk-wrong" },
  });
  fireEvent.click(button(scope, "Carregar modelos disponíveis"));
  expect((await within(scope).findByRole("alert")).textContent).toBe(
    "A OpenAI recusou esta chave. Confira se ela está certa.",
  );
  expect(within(scope).queryByLabelText("Modelos disponíveis")).toBeNull();
});

it("does not let an AI be used before it has a key and a model", async () => {
  routes["GET /api/settings"] = () =>
    Response.json(state({ openai: { has_key: true } }));
  renderWithProviders(<Settings />);
  const scope = await screen.findByRole("region", { name: "ChatGPT" });
  expect(button(scope, "Usar esta IA nas sessões").disabled).toBe(true);
  expect(
    within(scope).getByText("Escolha um modelo para usar o ChatGPT"),
  ).toBeTruthy();
  expect(button(card("Groq"), "Usar esta IA nas sessões").disabled).toBe(true);
  expect(
    within(card("Groq")).getByText("Salve a chave da Groq para usar o Groq"),
  ).toBeTruthy();
  expect(puts()).toHaveLength(0);
});

it("makes an AI the one in use once it has a key and a model", async () => {
  let current = state({ openai: { has_key: true, model: "gpt-5" } });
  routes["GET /api/settings"] = () => Response.json(current);
  routes["PUT /api/settings"] = () => {
    current = state(
      { openai: { has_key: true, model: "gpt-5" } },
      "openai",
      true,
    );
    return Response.json(current);
  };
  renderWithProviders(<Settings />);
  const scope = await screen.findByRole("region", { name: "ChatGPT" });
  fireEvent.click(button(scope, "Usar esta IA nas sessões"));

  expect(await within(scope).findByText("Em uso")).toBeTruthy();
  expect(puts()).toEqual([{ active_provider: "openai" }]);
  expect(
    screen.getByText(/Nas sessões o app usa ChatGPT \(gpt-5\)/),
  ).toBeTruthy();
  expect(
    within(scope).queryByRole("button", { name: "Usar esta IA nas sessões" }),
  ).toBeNull();
  expect(within(card("Claude")).queryByText("Em uso")).toBeNull();
});

it("disables key editing when the key comes from the environment, not the model", async () => {
  routes["GET /api/settings"] = () =>
    Response.json(state({ groq: { has_key: true, key_from_env: true } }));
  routes[`POST ${modelsUrl("groq")}`] = () =>
    Response.json({
      models: [{ id: "llama-3.3", label: "llama-3.3" }],
      source: "live",
    });
  renderWithProviders(<Settings />);
  const scope = await screen.findByRole("region", { name: "Groq" });
  expect(within(scope).getByText("Chave da variável de ambiente")).toBeTruthy();
  expect(
    within(scope).getByText(/variável de ambiente e não pode/),
  ).toBeTruthy();
  expect(
    (within(scope).getByLabelText("Chave da API da Groq") as HTMLInputElement)
      .disabled,
  ).toBe(true);
  for (const name of ["Salvar chave", "Remover chave"])
    expect(button(scope, name).disabled).toBe(true);

  const load = button(scope, "Carregar modelos disponíveis");
  expect(load.disabled).toBe(false);
  fireEvent.click(load);
  expect(
    await within(scope).findByLabelText("Modelos disponíveis"),
  ).toBeTruthy();
});

it("tests the connection of each provider separately", async () => {
  routes["GET /api/settings"] = () =>
    Response.json(
      state({
        anthropic: { has_key: true },
        openai: { has_key: true, model: "gpt-5" },
      }),
    );
  const replies = [
    { ok: true, message: "Conexão com o modelo funcionando." },
    { ok: false, message: "A OpenAI recusou esta chave." },
  ];
  routes["POST /api/settings/test-llm"] = () => Response.json(replies.shift());
  renderWithProviders(<Settings />);

  const claude = await screen.findByRole("region", { name: "Claude" });
  fireEvent.click(button(claude, "Testar conexão"));
  const ok = await within(claude).findByText(
    "Conexão com o modelo funcionando.",
  );
  expect(ok.closest("[role=status]")).toBeTruthy();
  expect(ok.closest("[aria-live=polite]")).toBeTruthy();

  const openai = card("ChatGPT");
  fireEvent.click(button(openai, "Testar conexão"));
  expect(
    await within(openai).findByText("A OpenAI recusou esta chave."),
  ).toBeTruthy();
  expect(bodies("POST", "/api/settings/test-llm")).toEqual([
    { provider: "anthropic" },
    { provider: "openai" },
  ]);
  expect(button(card("Groq"), "Testar conexão").disabled).toBe(true);
});
