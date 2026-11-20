import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Settings } from "./Settings";
import { renderWithProviders } from "./test-utils";

const state = (extra = {}) => ({
  has_key: false,
  key_from_env: false,
  model: "claude-haiku-4-5",
  ...extra,
});

type Route = (init?: RequestInit) => Response;
let routes: Record<string, Route>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  routes = {};
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

const bodyOfPut = () =>
  JSON.parse(
    fetchMock.mock.calls.find(([, i]) => i?.method === "PUT")![1].body,
  );

it("warns that the app is offline when no key is set", async () => {
  routes["GET /api/settings"] = () => Response.json(state());
  renderWithProviders(<Settings />);
  expect(await screen.findByText("Nenhuma chave configurada.")).toBeTruthy();
  expect(
    screen.getByText(
      "Sem chave da API: o app funciona em modo offline (letras, palavras e treino sem IA).",
    ),
  ).toBeTruthy();
  expect(
    (screen.getByLabelText("Nome do modelo") as HTMLInputElement).value,
  ).toBe("claude-haiku-4-5");
  expect(
    (screen.getByRole("button", { name: "Remover chave" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

it("saves the key without ever showing it back", async () => {
  routes["GET /api/settings"] = () => Response.json(state());
  routes["PUT /api/settings"] = () => Response.json(state({ has_key: true }));
  renderWithProviders(<Settings />);
  const input = (await screen.findByLabelText(
    "Nova chave da API",
  )) as HTMLInputElement;
  expect(input.type).toBe("password");
  fireEvent.change(input, { target: { value: "sk-secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar chave" }));

  expect(await screen.findByText("Chave configurada.")).toBeTruthy();
  expect(bodyOfPut()).toEqual({ api_key: "sk-secret" });
  expect(input.value).toBe("");
  expect(screen.queryByText(/modo offline/)).toBeNull();
});

it("removes the key by sending an empty string", async () => {
  let current = state({ has_key: true });
  routes["GET /api/settings"] = () => Response.json(current);
  routes["PUT /api/settings"] = () => {
    current = state();
    return Response.json(current);
  };
  renderWithProviders(<Settings />);
  fireEvent.click(await screen.findByRole("button", { name: "Remover chave" }));
  expect(await screen.findByText("Nenhuma chave configurada.")).toBeTruthy();
  expect(bodyOfPut()).toEqual({ api_key: "" });
});

it("saves the model", async () => {
  routes["GET /api/settings"] = () => Response.json(state());
  routes["PUT /api/settings"] = () =>
    Response.json(state({ model: "claude-sonnet-4-5" }));
  renderWithProviders(<Settings />);
  const input = await screen.findByLabelText("Nome do modelo");
  fireEvent.change(input, { target: { value: "claude-sonnet-4-5" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar modelo" }));
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(bodyOfPut()).toEqual({ model: "claude-sonnet-4-5" });
});

it("tests the connection: success and failure", async () => {
  routes["GET /api/settings"] = () => Response.json(state({ has_key: true }));
  const replies = [
    { ok: true, message: "Conexão com o modelo funcionando." },
    { ok: false, message: "Não foi possível falar com o modelo: timeout" },
  ];
  routes["POST /api/settings/test-llm"] = () => Response.json(replies.shift());
  renderWithProviders(<Settings />);

  fireEvent.click(
    await screen.findByRole("button", { name: "Testar conexão" }),
  );
  const ok = await screen.findByText("Conexão com o modelo funcionando.");
  expect(ok.className).toContain("text-success");
  expect(ok.parentElement!.getAttribute("aria-live")).toBe("polite");

  fireEvent.click(screen.getByRole("button", { name: "Testar conexão" }));
  const fail = await screen.findByText(/Não foi possível falar com o modelo/);
  expect(fail.className).toContain("text-danger");
});

it("disables key editing when the key comes from the environment", async () => {
  routes["GET /api/settings"] = () =>
    Response.json(state({ has_key: true, key_from_env: true }));
  renderWithProviders(<Settings />);
  expect(await screen.findByText(/variável de ambiente/)).toBeTruthy();
  expect(
    (screen.getByLabelText("Nova chave da API") as HTMLInputElement).disabled,
  ).toBe(true);
  for (const name of ["Salvar chave", "Remover chave"])
    expect(
      (screen.getByRole("button", { name }) as HTMLButtonElement).disabled,
    ).toBe(true);
});
