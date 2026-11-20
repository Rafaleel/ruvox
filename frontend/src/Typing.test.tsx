import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Play } from "./Play";

const textQuestion = (id: number, prompt: string, options: string[] = []) => ({
  id,
  type: "typing",
  prompt,
  input_kind: "text",
  options,
  item_ids: [id],
});

const answerOut = (correct: boolean, extra = {}) => ({
  correct,
  grade: correct ? 4 : 1,
  correct_answer: "привет",
  explanation: "Привет significa oi.",
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

const bodyOf = (url: string) =>
  JSON.parse(fetchMock.mock.calls.find(([u]) => u === url)![1].body as string);

const renderPlay = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <MemoryRouter>
        <Play />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const typeOnKeyboard = (letters: string) => {
  const keyboard = screen.getByRole("group", { name: "Teclado cirílico" });
  for (const letter of letters)
    fireEvent.click(within(keyboard).getByRole("button", { name: letter }));
};

it("starts a typing session with mode 4", async () => {
  routes["POST /api/sessions"] = () =>
    Response.json({
      session_id: 1,
      source: "offline",
      questions: [textQuestion(1, "Como se escreve oi?")],
    });
  renderPlay();
  fireEvent.click(screen.getByLabelText("Digitação"));
  fireEvent.click(screen.getByRole("button", { name: "Começar" }));
  expect(await screen.findByText("Como se escreve oi?")).toBeTruthy();
  expect(bodyOf("/api/sessions")).toEqual({ mode: 4, size: 10 });
});

it("answers a typing question with the on-screen keyboard", async () => {
  routes["POST /api/sessions"] = () =>
    Response.json({
      session_id: 2,
      source: "offline",
      // Stray options make sure digits would select one if the guard failed.
      questions: [textQuestion(1, "Como se escreve oi?", ["a", "b"])],
    });
  routes["POST /api/sessions/2/answers"] = () => Response.json(answerOut(true));
  renderPlay();
  fireEvent.click(screen.getByRole("button", { name: "Começar" }));

  const input = (await screen.findByLabelText(
    "Sua resposta em russo",
  )) as HTMLInputElement;
  expect(document.activeElement).toBe(input);
  // Text questions never render the choice list.
  expect(screen.queryByRole("button", { name: "a" })).toBeNull();
  expect(input.lang).toBe("ru");
  expect(input.getAttribute("spellcheck")).toBe("false");
  expect(input.getAttribute("autocomplete")).toBe("off");
  expect(
    (screen.getByRole("button", { name: "Responder" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);

  typeOnKeyboard("приветт");
  fireEvent.click(screen.getByRole("button", { name: "apagar" }));
  expect(input.value).toBe("привет");
  // Physical keyboard typing keeps working, and digits are plain text.
  fireEvent.change(input, { target: { value: "привет1" } });
  fireEvent.keyDown(input, { key: "1" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.change(input, { target: { value: "привет" } });

  fireEvent.click(screen.getByRole("button", { name: "Responder" }));
  expect(await screen.findByText("Correto!")).toBeTruthy();
  expect(bodyOf("/api/sessions/2/answers")).toMatchObject({
    question_id: 1,
    answer: "привет",
  });
  expect(screen.getByText("Привет significa oi.")).toBeTruthy();
  expect(screen.getByText("привет", { selector: "strong" })).toBeTruthy();
});

it("submits with Enter and requeues a missed text question", async () => {
  routes["POST /api/sessions"] = () =>
    Response.json({
      session_id: 3,
      source: "offline",
      questions: [textQuestion(1, "Como se escreve oi?")],
    });
  const answers = [
    answerOut(false, {
      requeued_question: textQuestion(2, "Como se escreve oi? (de novo)"),
    }),
    answerOut(true),
  ];
  routes["POST /api/sessions/3/answers"] = () =>
    Response.json(answers.shift()!);
  routes["POST /api/sessions/3/finish"] = () =>
    Response.json({
      score: 1,
      answered: 2,
      correct: 1,
      items_to_review: [],
      ended_at: "2026-01-01T00:00:00Z",
    });
  renderPlay();
  fireEvent.click(screen.getByRole("button", { name: "Começar" }));

  const first = await screen.findByLabelText("Sua resposta em russo");
  typeOnKeyboard("пр");
  fireEvent.submit(first.closest("form")!);
  expect(await screen.findByText("Errou.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

  expect(await screen.findByText("Como se escreve oi? (de novo)")).toBeTruthy();
  const second = screen.getByLabelText("Sua resposta em russo");
  expect((second as HTMLInputElement).value).toBe("");
  expect(document.activeElement).toBe(second);
  typeOnKeyboard("привет");
  fireEvent.submit(second.closest("form")!);
  expect(await screen.findByText("Correto!")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(await screen.findByText("Resultado")).toBeTruthy();
});
