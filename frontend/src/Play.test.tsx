import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Play } from "./Play";

const question = (id: number, prompt: string) => ({
  id,
  type: "letter_to_sound",
  prompt,
  input_kind: "choice",
  options: ["tch", "sh", "ra", "ve"],
  item_ids: [id],
});

const answerOut = (correct: boolean, extra = {}) => ({
  correct,
  grade: correct ? 4 : 1,
  correct_answer: "tch",
  explanation: "Ч soa como tch.",
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
  vi.unstubAllGlobals();
});

const renderPlay = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <Play />
    </QueryClientProvider>,
  );

const bodyOf = (url: string) =>
  JSON.parse(fetchMock.mock.calls.find(([u]) => u === url)![1].body as string);

it("plays a session: start, answer, requeue, finish, result", async () => {
  routes["POST /api/sessions"] = () =>
    Response.json({
      session_id: 7,
      source: "offline",
      questions: [question(1, "Como se lê Ч?"), question(2, "Como se lê Ш?")],
    });
  const answers = [
    answerOut(true),
    answerOut(false, { requeued_question: question(3, "Como se lê Ш?") }),
    answerOut(true),
  ];
  routes["POST /api/sessions/7/answers"] = () =>
    Response.json(answers.shift()!);
  routes["POST /api/sessions/7/finish"] = () =>
    Response.json({
      score: 2,
      answered: 3,
      correct: 2,
      items_to_review: [
        {
          id: 2,
          kind: "letter",
          text: "Ш ш",
          pronunciation: "sh",
          meaning: "som sh",
          source: "seed",
          group: 3,
          difficulty: 1,
        },
      ],
      ended_at: "2026-01-01T00:00:00Z",
    });

  renderPlay();
  fireEvent.click(screen.getByLabelText("5"));
  fireEvent.click(screen.getByRole("button", { name: "Começar" }));

  // Q1: the answer is not on screen before answering.
  expect(await screen.findByText("Como se lê Ч?")).toBeTruthy();
  expect(bodyOf("/api/sessions")).toEqual({ mode: "mixed", size: 5 });
  expect(screen.queryByText("Ч soa como tch.")).toBeNull();
  expect(screen.getByText("Pergunta 1 de 2")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /tch|sh|ra|ve/ })).toHaveLength(
    4,
  );

  fireEvent.click(screen.getByRole("button", { name: /tch/ }));
  expect(await screen.findByText("Correto!")).toBeTruthy();
  expect(screen.getByText("Ч soa como tch.")).toBeTruthy();
  expect(screen.getByText("Acertos: 1")).toBeTruthy();
  expect(bodyOf("/api/sessions/7/answers")).toMatchObject({
    question_id: 1,
    answer: "tch",
    time_ms: expect.any(Number),
  });
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

  // Q2 answered with the keyboard (option 2), wrong: a third question is appended.
  expect(await screen.findByText("Pergunta 2 de 2")).toBeTruthy();
  fireEvent.keyDown(window, { key: "2" });
  expect(await screen.findByText("Errou.")).toBeTruthy();
  fireEvent.keyDown(document.body, { key: "Enter" });
  expect(await screen.findByText("Pergunta 3 de 3")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /tch/ }));
  await screen.findByText("Correto!");
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

  expect(await screen.findByText("2/3")).toBeTruthy();
  const review = within(screen.getByRole("list"));
  expect(review.getByText("Ш ш")).toBeTruthy();
  expect(review.getByText("(sh)")).toBeTruthy();
  expect(review.getByText("som sh")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Jogar de novo" }));
  expect(screen.getByRole("button", { name: "Começar" })).toBeTruthy();
});

it("shows a friendly message when there is nothing to practice", async () => {
  routes["POST /api/sessions"] = () =>
    Response.json(
      { detail: "Ainda não há nada para treinar neste modo." },
      { status: 409 },
    );
  renderPlay();
  fireEvent.click(screen.getByRole("button", { name: "Começar" }));
  expect(
    await screen.findByText(/Ainda não há nada para treinar/),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
});

it("retries after a network error", async () => {
  fetchMock.mockRejectedValueOnce(new TypeError("failed to fetch"));
  routes["POST /api/sessions"] = () =>
    Response.json({
      session_id: 1,
      source: "offline",
      questions: [question(1, "Como se lê Ч?")],
    });
  renderPlay();
  fireEvent.click(screen.getByRole("button", { name: "Começar" }));
  expect(
    await screen.findByText(/Não foi possível falar com o serviço local/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
  expect(await screen.findByText("Como se lê Ч?")).toBeTruthy();
});
