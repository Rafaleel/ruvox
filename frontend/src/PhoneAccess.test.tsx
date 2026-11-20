import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PhoneAccess } from "./PhoneAccess";
import { renderWithProviders } from "./test-utils";

const lan = (extra = {}) => ({
  enabled: false,
  running: false,
  port: 8787,
  urls: [],
  code: null,
  ...extra,
});
const on = {
  enabled: true,
  running: true,
  urls: ["http://192.168.0.12:8787/"],
};

type Route = (init?: RequestInit) => Response;
let routes: Record<string, Route>;
let fetchMock: ReturnType<typeof vi.fn>;
const reload = vi.fn();

beforeEach(() => {
  routes = {};
  reload.mockClear();
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const route = routes[`${init?.method ?? "GET"} ${url}`];
    if (!route) throw new Error(`unexpected request ${url}`);
    return route(init);
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { reload });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const calls = (method: string, url: string) =>
  fetchMock.mock.calls.filter(
    ([u, i]) => u === url && (i?.method ?? "GET") === method,
  );

/** Advances fake time and lets pending promises settle. */
const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

it("hides the section when the page is open on a phone (403)", async () => {
  routes["GET /api/lan"] = () =>
    Response.json(
      { detail: "Isto só pode ser feito no computador." },
      { status: 403 },
    );
  renderWithProviders(<PhoneAccess />);
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 20));
  expect(screen.queryByText("Acesso pelo celular")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("is off by default and asks for confirmation before enabling", async () => {
  routes["GET /api/lan"] = () => Response.json(lan());
  routes["PUT /api/lan"] = () =>
    Response.json(lan({ enabled: true, running: false }));
  renderWithProviders(<PhoneAccess />);
  const toggle = await screen.findByRole("switch", {
    name: "Permitir acesso pelo celular",
  });
  expect((toggle as HTMLInputElement).checked).toBe(false);

  fireEvent.click(toggle);
  expect(
    screen.getByText(
      "Quem for pareado poderá usar o app, inclusive a chave da API configurada. Ative só em redes em que você confia.",
    ),
  ).toBeTruthy();
  expect(calls("PUT", "/api/lan")).toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(calls("PUT", "/api/lan")).toHaveLength(0);
});

it("enables, announces the restart and reloads once the app answers", async () => {
  vi.useFakeTimers();
  routes["GET /api/lan"] = () => Response.json(lan());
  routes["PUT /api/lan"] = () =>
    Response.json(lan({ enabled: true, running: false }));
  let up = false;
  routes["GET /api/health"] = () => {
    if (!up) throw new TypeError("connection refused");
    return Response.json({ status: "ok" });
  };
  renderWithProviders(<PhoneAccess />);
  await tick(10);
  fireEvent.click(screen.getByRole("switch"));
  fireEvent.click(screen.getByRole("button", { name: "Ativar acesso" }));
  await tick(10);

  expect(JSON.parse(calls("PUT", "/api/lan")[0][1].body)).toEqual({
    enabled: true,
  });
  expect(screen.getByText("O app vai reiniciar…")).toBeTruthy();
  expect(calls("GET", "/api/health")).toHaveLength(0);

  await tick(2100);
  expect(reload).not.toHaveBeenCalled();
  up = true;
  await tick(1100);
  expect(reload).toHaveBeenCalledTimes(1);
});

it("gives up with a message when the app does not come back in 30 s", async () => {
  vi.useFakeTimers();
  routes["GET /api/lan"] = () => Response.json(on);
  routes["PUT /api/lan"] = () =>
    Response.json(lan({ enabled: false, running: true }));
  routes["GET /api/health"] = () => {
    throw new TypeError("connection refused");
  };
  renderWithProviders(<PhoneAccess />);
  await tick(10);
  fireEvent.click(screen.getByRole("switch")); // turning off needs no warning
  await tick(10);
  expect(screen.getByText("O app vai reiniciar…")).toBeTruthy();

  await tick(33000);
  expect(screen.getByText(/não voltou em 30 segundos/)).toBeTruthy();
  expect(reload).not.toHaveBeenCalled();
});

it("shows addresses and the code, renews it and unpairs after confirming", async () => {
  routes["GET /api/lan"] = () => Response.json(lan({ ...on, code: "123456" }));
  routes["POST /api/lan/code"] = () => Response.json({ code: "654321" });
  routes["POST /api/lan/unpair"] = () => new Response(null, { status: 204 });
  renderWithProviders(<PhoneAccess />);

  expect(await screen.findByText("http://192.168.0.12:8787/")).toBeTruthy();
  expect(screen.getByText("123456")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Renovar código" }));
  expect(await screen.findByText("654321")).toBeTruthy();
  expect(screen.getByText("Código renovado.")).toBeTruthy();

  fireEvent.click(
    screen.getByRole("button", { name: "Desparear todos os celulares" }),
  );
  expect(calls("POST", "/api/lan/unpair")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Desparear todos" }));
  expect(
    await screen.findByText("Todos os celulares foram desconectados."),
  ).toBeTruthy();
  expect(calls("POST", "/api/lan/unpair")).toHaveLength(1);
});

it("says a restart is pending when enabled but not running yet", async () => {
  routes["GET /api/lan"] = () => Response.json(lan({ enabled: true }));
  renderWithProviders(<PhoneAccess />);
  expect(await screen.findByText(/Reinício pendente/)).toBeTruthy();
  expect(screen.queryByText("Código de pareamento")).toBeNull();
});
