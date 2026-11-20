import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Play } from "./Play";
import { renderWithProviders } from "./test-utils";

// Invented words: never real lyrics.
const base = { options: [], item_ids: [1] };
const flip = (id: number, prompt: string, reveal: string) => ({
  ...base,
  id,
  type: "flashcard",
  prompt,
  input_kind: "flip",
  reveal,
});
const pairsQuestion = {
  ...base,
  id: 5,
  type: "pairs",
  prompt: "Una cada palavra ao seu significado antes que o tempo acabe.",
  input_kind: "pairs",
  item_ids: [1, 2, 3],
  pairs: [
    { item_id: 1, left: "ночь", right: "noite" },
    { item_id: 2, left: "дом", right: "casa" },
    { item_id: 3, left: "друг", right: "amigo" },
  ],
};
const session = (questions: unknown[]) => () =>
  Response.json({ session_id: 7, source: "offline", questions });
const answerOut = (correct: boolean, extra = {}) => ({
  correct,
  grade: correct ? 4 : 1,
  correct_answer: "",
  explanation: "ночь — noch — noite",
  ...extra,
});

type Route = () => Response;
let routes: Record<string, Route>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  routes = {};
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const route = routes[`${init?.method ?? "GET"} ${url}`];
    if (!route) throw new Error(`unexpected request ${url}`);
    return route();
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const bodyOf = (url: string) =>
  JSON.parse(fetchMock.mock.calls.find(([u]) => u === url)![1].body as string);
const answers = () =>
  fetchMock.mock.calls.filter(([u]) => u === "/api/sessions/7/answers");
const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));

it("starts the chosen mode for the song in the URL and can clear it", async () => {
  routes["GET /api/songs/3"] = () =>
    Response.json({ id: 3, title: "Ночная песня", items: 6 });
  routes["POST /api/sessions"] = session([flip(1, "ночь", "noch — noite")]);
  renderWithProviders(<Play />, "/play?song=3");
  expect(await screen.findByText("Ночная песня")).toBeTruthy();
  expect(screen.getByText(/Treinando:/)).toBeTruthy();

  fireEvent.click(screen.getByLabelText("Cartões"));
  click("Começar");
  await screen.findByText("ночь");
  expect(bodyOf("/api/sessions")).toEqual({ mode: 5, size: 10, song_id: 3 });
});

it("sends no song_id after clearing it, and explains the cloze mode", async () => {
  routes["GET /api/songs/3"] = () => Response.json({ id: 3, title: "Песня" });
  routes["POST /api/sessions"] = session([flip(1, "ночь", "noch — noite")]);
  renderWithProviders(<Play />, "/play?song=3");
  await screen.findByText("Песня");
  click("Limpar");
  expect(screen.queryByText(/Treinando:/)).toBeNull();

  fireEvent.click(screen.getByLabelText("Lacuna"));
  expect(
    screen.getByText("Precisa de palavras de músicas salvas."),
  ).toBeTruthy();
  click("Começar");
  await screen.findByText("ночь");
  expect(bodyOf("/api/sessions")).toEqual({ mode: 7, size: 10 });
});

it("plays flashcards: flip, then knew or missed", async () => {
  routes["POST /api/sessions"] = session([
    flip(1, "ночь", "noch — noite"),
    flip(2, "дом", "dom — casa"),
  ]);
  let call = 0;
  routes["POST /api/sessions/7/answers"] = () =>
    Response.json(answerOut(call++ === 0));
  renderWithProviders(<Play />);
  click("Começar");

  expect(await screen.findByText("ночь")).toBeTruthy();
  expect(screen.queryByText("noch — noite")).toBeNull();
  expect(screen.queryByRole("button", { name: "Sabia" })).toBeNull();
  fireEvent.keyDown(window, { key: "1" }); // not an option shortcut here
  expect(answers()).toHaveLength(0);

  click("Virar");
  expect(screen.getByText("noch — noite")).toBeTruthy();
  click("Sabia");
  expect(await screen.findByText("Correto!")).toBeTruthy();
  expect(bodyOf("/api/sessions/7/answers")).toMatchObject({
    question_id: 1,
    answer: "knew",
  });
  click("Próxima");

  await screen.findByText("дом");
  click("Virar");
  click("Errei");
  expect(await screen.findByText("Errou.")).toBeTruthy();
  expect(JSON.parse(answers()[1][1].body).answer).toBe("missed");
});

const startPairs = async () => {
  routes["POST /api/sessions"] = session([pairsQuestion]);
  routes["POST /api/sessions/7/answers"] = () =>
    Response.json(answerOut(false));
  renderWithProviders(<Play />);
  click("Começar");
  await screen.findByText("ночь");
};
const match = (left: string, right: string) => {
  click(left);
  click(right);
};

it("plays pairs: counts a wrong tap and submits when all are matched", async () => {
  await startPairs();
  click("ночь");
  click("casa"); // wrong: one mistake for ночь
  expect(screen.getByText("Não combina. Tente de novo.")).toBeTruthy();
  match("ночь", "noite");
  match("дом", "casa");
  expect(
    (screen.getByRole("button", { name: "noite" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(answers()).toHaveLength(0);
  match("друг", "amigo");

  expect(await screen.findByText("Errou.")).toBeTruthy();
  expect(JSON.parse(bodyOf("/api/sessions/7/answers").answer)).toEqual({
    1: 1,
    2: 0,
    3: 0,
  });
});

it("submits an extra mistake for each unmatched pair when time runs out", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  await startPairs();
  match("ночь", "noite");
  expect(screen.getByText("Tempo: 60s")).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(50_000));
  expect(screen.getByText("Faltam 10 segundos.")).toBeTruthy();
  expect(answers()).toHaveLength(0);
  await act(() => vi.advanceTimersByTimeAsync(10_000));

  expect(await screen.findByText("Errou.")).toBeTruthy();
  expect(answers()).toHaveLength(1);
  expect(JSON.parse(bodyOf("/api/sessions/7/answers").answer)).toEqual({
    1: 0,
    2: 1,
    3: 1,
  });
});

it("renders a cloze question with its blank as a normal choice", async () => {
  routes["POST /api/sessions"] = session([
    {
      id: 1,
      type: "cloze",
      prompt: "Complete o trecho: «Звезда горит над ____» (significado: casa)",
      input_kind: "choice",
      options: ["домом", "рекой", "ночью"],
      item_ids: [1],
    },
  ]);
  routes["POST /api/sessions/7/answers"] = () =>
    Response.json(answerOut(true, { correct_answer: "домом" }));
  renderWithProviders(<Play />);
  click("Começar");
  expect(await screen.findByText(/над ____/)).toBeTruthy();
  fireEvent.keyDown(window, { key: "1" });
  expect(await screen.findByText("Correto!")).toBeTruthy();
  expect(bodyOf("/api/sessions/7/answers").answer).toBe("домом");
});
