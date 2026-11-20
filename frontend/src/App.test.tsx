import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { mockFetch, progress, renderWithProviders } from "./test-utils";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("renders the nav links and switches routes", async () => {
  mockFetch({
    "/api/health": { status: "ok" },
    "/api/progress": progress,
    "/api/items?kind=letter": [],
  });
  renderWithProviders(<App />);
  const nav = screen.getByRole("navigation", { name: "Navegação principal" });
  const names = Array.from(nav.querySelectorAll("a")).map((a) => [
    a.textContent,
    a.getAttribute("href"),
  ]);
  expect(names).toEqual([
    ["Início", "/"],
    ["Jogar", "/play"],
    ["Alfabeto", "/alphabet"],
  ]);
  expect(await screen.findByText("Serviço local conectado")).toBeTruthy();

  fireEvent.click(screen.getByRole("link", { name: "Alfabeto" }));
  expect(screen.getByRole("heading", { name: "Alfabeto" })).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Alfabeto" }).getAttribute("aria-current"),
  ).toBe("page");
});
