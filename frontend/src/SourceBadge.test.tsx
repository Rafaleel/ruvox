import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { Play } from "./Play";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const question = {
  id: 1,
  type: "letter_to_sound",
  prompt: "Como se lê Ч?",
  input_kind: "choice",
  options: ["tch", "sh"],
  item_ids: [1],
};

const routes: Record<string, (source: string) => unknown> = {
  "POST /api/sessions": (source) => ({
    session_id: 1,
    source,
    questions: [question],
  }),
  "POST /api/sessions/1/answers": () => ({
    correct: true,
    grade: 4,
    correct_answer: "tch",
    explanation: "Ч soa como tch.",
  }),
  "POST /api/sessions/1/finish": () => ({
    score: 1,
    answered: 1,
    correct: 1,
    items_to_review: [],
    ended_at: "2026-01-01T00:00:00Z",
  }),
};

it.each([
  ["ai", "IA", "Perguntas geradas pela IA"],
  ["offline", "Offline", "Perguntas do conteúdo local, sem IA"],
])(
  "shows the %s badge during the session and on the result",
  async (source, label, hint) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) =>
        Response.json(routes[`${init?.method} ${url}`](source)),
      ),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Play />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));

    expect((await screen.findByText(label)).getAttribute("title")).toBe(hint);

    fireEvent.click(screen.getByRole("button", { name: /tch/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Próxima" }));
    expect(await screen.findByText("Resultado")).toBeTruthy();
    expect(screen.getByText(label).getAttribute("title")).toBe(hint);
  },
);
