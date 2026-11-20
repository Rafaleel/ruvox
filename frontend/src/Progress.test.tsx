import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Progress } from "./Progress";
import {
  mockFetch,
  renderWithProviders,
  stats,
  WithStatus,
} from "./test-utils";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows the streak, mastery numbers and an accessible activity chart", async () => {
  mockFetch({ "/api/stats": stats });
  renderWithProviders(<Progress />);

  expect(
    await screen.findByRole("heading", { name: "Sequência: 1 dia" }),
  ).toBeTruthy();
  expect(screen.getByText("Melhor sequência: 5 dias")).toBeTruthy();
  expect(screen.queryByText(/pelo menos 5 respostas/)).toBeNull();

  expect(
    screen
      .getByRole("img", { name: /Novos: 4, Aprendendo: 3/ })
      .getAttribute("aria-label"),
  ).toBe("Novos: 4, Aprendendo: 3, Familiares: 2, Dominados: 1");

  const chart = screen.getByRole("img", { name: /Respostas por dia/ });
  expect(chart.getAttribute("aria-label")).toBe(
    "Respostas por dia nos últimos 30 dias: 10 no total, 7 corretas.",
  );
  expect(chart.querySelectorAll("rect")).toHaveLength(2);

  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(31);
  expect(
    within(within(table).getAllByRole("row")[1]).getAllByRole("cell")[0]
      .textContent,
  ).toBe("10");
});

it("nudges the learner when today has no qualifying session", async () => {
  mockFetch({ "/api/stats": { ...stats, streak: 0, today_done: false } });
  renderWithProviders(<Progress />);
  expect(
    await screen.findByText("Faça uma sessão com pelo menos 5 respostas hoje"),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Sequência: 0 dias" }),
  ).toBeTruthy();
});

it("offers a retry when stats fail to load", async () => {
  mockFetch({ "/api/stats": new WithStatus({}, 500) });
  renderWithProviders(<Progress />);
  expect(
    await screen.findByRole("button", { name: "Tentar de novo" }),
  ).toBeTruthy();
});
