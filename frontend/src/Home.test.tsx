import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Home } from "./Home";
import {
  letterMap,
  mockFetch,
  progress,
  renderWithProviders,
  stats,
  WithStatus,
} from "./test-utils";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each([
  [200, "Serviço local conectado"],
  [503, "Serviço local indisponível"],
] as const)(
  "shows local service status for HTTP %i",
  async (status, message) => {
    mockFetch({
      "/api/health": new WithStatus({ status: "ok" }, status),
      "/api/progress": progress,
      "/api/progress/letters": letterMap,
    });
    renderWithProviders(<Home />);
    expect(
      screen.getByRole("heading", { name: "Vamos praticar?" }),
    ).toBeTruthy();
    expect(await screen.findByText(message)).toBeTruthy();
  },
);

it("shows due count, group progress and words unlocked", async () => {
  mockFetch({
    "/api/health": { status: "ok" },
    "/api/progress": progress,
    "/api/progress/letters": letterMap,
  });
  renderWithProviders(<Home />);

  expect(await screen.findByText("Para revisar")).toBeTruthy();
  expect(screen.getByText("3")).toBeTruthy();
  expect(screen.getByText("itens agora")).toBeTruthy();
  // The alphabet map replaces the old group rings: mastered letters per group.
  const group1 = screen.getByRole("list", {
    name: "Grupo 1: iguais ao português",
  });
  expect(within(group1).getAllByRole("link")).toHaveLength(5);
  expect(screen.getByText("2/5")).toBeTruthy();
  expect(screen.getByText("0/20")).toBeTruthy();
  expect(screen.getByText("12")).toBeTruthy();
  expect(screen.getByText("de 40 liberadas")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Jogar agora" }).getAttribute("href"),
  ).toBe("/play");
});

it("invites a first-time learner to start and hides the empty stats", async () => {
  mockFetch({
    "/api/health": { status: "ok" },
    "/api/progress": {
      ...progress,
      due_count: 0,
      groups: progress.groups.map((g) => ({ ...g, learned: 0 })),
      words_unlocked: 0,
    },
    "/api/progress/letters": letterMap,
    "/api/stats": { ...stats, streak: 0 },
  });
  renderWithProviders(<Home />);
  expect(await screen.findByText(/Sua primeira sessão/)).toBeTruthy();
  expect(screen.queryByText("Para revisar")).toBeNull();
  expect(screen.getByRole("heading", { name: "Como funciona" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Jogar agora" })).toBeTruthy();
});

it("shows the streak badge and a visible alphabet link", async () => {
  mockFetch({
    "/api/health": { status: "ok" },
    "/api/progress": progress,
    "/api/progress/letters": letterMap,
    "/api/stats": stats,
  });
  renderWithProviders(<Home />);
  const badge = await screen.findByRole("link", { name: /Sequência: 1 dia/ });
  expect(badge.getAttribute("href")).toBe("/progress");
  expect(
    screen
      .getByRole("link", { name: /alfabeto completo/ })
      .getAttribute("href"),
  ).toBe("/alphabet");
});

it("hides the streak badge when stats fail", async () => {
  mockFetch({
    "/api/health": { status: "ok" },
    "/api/progress": progress,
    "/api/progress/letters": letterMap,
    "/api/stats": new WithStatus({}, 500),
  });
  renderWithProviders(<Home />);
  expect(await screen.findByText("Para revisar")).toBeTruthy();
  expect(screen.queryByText(/Sequência/)).toBeNull();
});

it("offers a retry when progress fails to load", async () => {
  mockFetch({
    "/api/health": { status: "ok" },
    "/api/progress": new WithStatus({}, 500),
    "/api/progress/letters": letterMap,
  });
  renderWithProviders(<Home />);
  expect(
    await screen.findByRole("button", { name: "Tentar de novo" }),
  ).toBeTruthy();
});
