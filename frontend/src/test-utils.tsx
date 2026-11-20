import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";

/** Wraps a route body with a non-200 status. */
export class WithStatus {
  constructor(
    readonly body: unknown,
    readonly status: number,
  ) {}
}

/** Stubs `fetch`: each route is a response body or a `WithStatus`. */
export function mockFetch(routes: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const route = routes[url];
      if (route === undefined) return Response.json({}, { status: 404 });
      return route instanceof WithStatus
        ? Response.json(route.body, { status: route.status })
        : Response.json(route);
    }),
  );
}

export function renderWithProviders(ui: ReactNode, route = "/") {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

export const progress = {
  due_count: 3,
  groups: [
    { group: 1, total: 5, learned: 2 },
    { group: 2, total: 8, learned: 0 },
    { group: 3, total: 20, learned: 1 },
  ],
  words_unlocked: 12,
  words_total: 40,
};

export const stats = {
  mastery: { new: 4, learning: 3, familiar: 2, mastered: 1 },
  days: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-03-${String(i + 1).padStart(2, "0")}`,
    answered: i === 29 ? 10 : 0,
    correct: i === 29 ? 7 : 0,
    sessions: i === 29 ? 1 : 0,
  })),
  streak: 1,
  best_streak: 5,
  today_done: true,
};
