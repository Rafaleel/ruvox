import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("renders the nav links and switches routes", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ status: "ok" })),
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
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
