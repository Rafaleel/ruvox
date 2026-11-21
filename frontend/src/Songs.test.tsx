import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Songs } from "./Songs";
import { renderWithProviders } from "./test-utils";

// Invented text: never real lyrics.
const song = (extra = {}) => ({
  id: 3,
  title: "Тестовая песня",
  artist: "Ансамбль",
  created_at: "2026-01-01T00:00:00",
  characters: 40,
  items: 0,
  ...extra,
});

const entry = (text: string, extra = {}) => ({
  text,
  lemma: text,
  pronunciation_pt: "pro-nún",
  meaning_pt: `significado de ${text}`,
  part_of_speech: "substantivo",
  excerpt: `${text} ночью`,
  kind: "word",
  existing_item_id: null,
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

const bodyOf = (method: string, url: string) =>
  JSON.parse(
    fetchMock.mock.calls.find(([u, i]) => u === url && i?.method === method)![1]
      .body,
  );

it("lists songs with a practice link only when there are words", async () => {
  routes["GET /api/songs"] = () =>
    Response.json([song({ items: 4 }), song({ id: 4, title: "Пустая" })]);
  renderWithProviders(<Songs />);
  expect(await screen.findByText("Тестовая песня")).toBeTruthy();
  expect(screen.getByText("4 palavras salvas")).toBeTruthy();
  const links = screen.getAllByRole("link", { name: "Treinar esta música" });
  expect(links).toHaveLength(1);
  expect(links[0].getAttribute("href")).toBe("/play?song=3");
});

it("creates a song and refreshes the list", async () => {
  let created = false;
  routes["GET /api/songs"] = () => Response.json(created ? [song()] : []);
  routes["POST /api/songs"] = () => {
    created = true;
    return Response.json(song(), { status: 201 });
  };
  renderWithProviders(<Songs />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Adicionar música" }),
  );
  fireEvent.change(screen.getByLabelText("Título"), {
    target: { value: " Тестовая песня " },
  });
  fireEvent.change(screen.getByLabelText(/Letra/), {
    target: { value: "слова слова" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar música" }));
  expect(
    await screen.findByRole("heading", { name: "Тестовая песня" }),
  ).toBeTruthy();
  expect(bodyOf("POST", "/api/songs")).toEqual({
    title: "Тестовая песня",
    artist: "",
    text: "слова слова",
  });
});

it("blocks saving above 20,000 characters and explains why", async () => {
  routes["GET /api/songs"] = () => Response.json([]);
  renderWithProviders(<Songs />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Adicionar música" }),
  );
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "T" } });
  const lyrics = screen.getByLabelText(/Letra/);
  fireEvent.change(lyrics, { target: { value: "а".repeat(20000) } });
  const save = screen.getByRole("button", { name: "Salvar música" });
  expect((save as HTMLButtonElement).disabled).toBe(false);
  fireEvent.change(lyrics, { target: { value: "а".repeat(20001) } });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/20\.001 \/ 20\.000 caracteres/)).toBeTruthy();
  expect(screen.getByText(/passou do limite/)).toBeTruthy();
});

it("asks for confirmation before deleting and mentions the progress", async () => {
  let deleted = false;
  routes["GET /api/songs"] = () => Response.json(deleted ? [] : [song()]);
  routes["DELETE /api/songs/3"] = () => {
    deleted = true;
    return new Response(null, { status: 204 });
  };
  renderWithProviders(<Songs />);
  fireEvent.click(await screen.findByRole("button", { name: "Apagar" }));
  expect(
    screen.getByText(/progresso nessas palavras também serão apagados/),
  ).toBeTruthy();
  expect(fetchMock.mock.calls.some(([, i]) => i?.method === "DELETE")).toBe(
    false,
  );
  fireEvent.click(screen.getByRole("button", { name: "Apagar de vez" }));
  expect(
    await screen.findByText("Você ainda não adicionou músicas."),
  ).toBeTruthy();
});

it("reviews an analysis and sends only the selected entries", async () => {
  routes["GET /api/songs"] = () => Response.json([song()]);
  routes["POST /api/songs/3/analyze"] = () =>
    Response.json({
      entries: [
        entry("ночь"),
        entry("звезда", { kind: "expression" }),
        entry("дом", { existing_item_id: 9 }),
      ],
      grammar: [{ point_pt: "Verbo no passado", excerpt: "я шёл" }],
    });
  routes["POST /api/songs/3/confirm"] = () =>
    Response.json({ created: 1, skipped: 0, rejected: 0 });
  renderWithProviders(<Songs />);
  fireEvent.click(await screen.findByRole("button", { name: "Analisar" }));
  expect(await screen.findByText("Pontos de gramática")).toBeTruthy();
  expect(screen.getByText("Verbo no passado")).toBeTruthy();

  const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
  expect(boxes.map((b) => b.checked)).toEqual([true, true, false]);
  expect(boxes[2].disabled).toBe(true);
  expect(screen.getByText(/já estudada/)).toBeTruthy();
  expect(screen.getByText("2 de 2 selecionadas")).toBeTruthy();

  fireEvent.click(boxes[1]);
  expect(screen.getByText("1 de 2 selecionadas")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Salvar selecionadas/ }));

  expect(await screen.findByText("1 palavra adicionada")).toBeTruthy();
  expect(bodyOf("POST", "/api/songs/3/confirm")).toEqual({
    entries: [
      {
        text: "ночь",
        pronunciation_pt: "pro-nún",
        meaning_pt: "significado de ночь",
        kind: "word",
        excerpt: "ночь ночью",
      },
    ],
  });
  const train = screen.getByRole("link", { name: "Treinar esta música" });
  expect(train.getAttribute("href")).toBe("/play?song=3");
});

it("links to settings when the analysis needs an API key", async () => {
  routes["GET /api/songs"] = () => Response.json([song()]);
  routes["POST /api/songs/3/analyze"] = () =>
    Response.json(
      { detail: "A análise de músicas precisa da chave da API." },
      { status: 503 },
    );
  renderWithProviders(<Songs />);
  fireEvent.click(await screen.findByRole("button", { name: "Analisar" }));
  expect(
    await screen.findByText("A análise de músicas precisa da chave da API."),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Abrir Configurações" })
      .getAttribute("href"),
  ).toBe("/settings");
});

it("offers a retry when the analysis finds no Russian vocabulary", async () => {
  routes["GET /api/songs"] = () => Response.json([song()]);
  routes["POST /api/songs/3/analyze"] = () =>
    Response.json(
      { detail: "Não encontrei vocabulário em russo nesta letra." },
      { status: 422 },
    );
  renderWithProviders(<Songs />);
  fireEvent.click(await screen.findByRole("button", { name: "Analisar" }));
  expect(await screen.findByText(/Não encontrei vocabulário/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  expect(
    screen.queryByRole("link", { name: "Abrir Configurações" }),
  ).toBeNull();
});
