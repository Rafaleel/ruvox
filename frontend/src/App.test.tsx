import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";
import {
  mockFetch,
  progress,
  renderWithProviders,
  WithStatus,
} from "./test-utils";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const desktop = { required: false, paired: true };

it("renders the nav links and switches routes", async () => {
  mockFetch({
    "/api/lan/status": desktop,
    "/api/health": { status: "ok" },
    "/api/progress": progress,
    "/api/items?kind=letter": [],
  });
  renderWithProviders(<App />);
  const nav = await screen.findByRole("navigation", {
    name: "Navegação principal",
  });
  const names = Array.from(nav.querySelectorAll("a")).map((a) => [
    a.textContent,
    a.getAttribute("href"),
  ]);
  expect(names).toEqual([
    ["Início", "/"],
    ["Jogar", "/play"],
    ["Músicas", "/songs"],
    ["Progresso", "/progress"],
    ["Configurações", "/settings"],
  ]);
  expect(await screen.findByText("Serviço local conectado")).toBeTruthy();

  fireEvent.click(screen.getByRole("link", { name: "Configurações" }));
  expect(
    screen
      .getByRole("link", { name: "Configurações" })
      .getAttribute("aria-current"),
  ).toBe("page");
});

it("shows the pairing page instead of the app for an unpaired phone", async () => {
  mockFetch({ "/api/lan/status": { required: true, paired: false } });
  renderWithProviders(<App />);
  expect(await screen.findByRole("button", { name: "Parear" })).toBeTruthy();
  expect(screen.queryByRole("navigation")).toBeNull();
});

it("shows the app for a paired phone", async () => {
  mockFetch({
    "/api/lan/status": { required: true, paired: true },
    "/api/health": { status: "ok" },
    "/api/progress": progress,
  });
  renderWithProviders(<App />);
  expect(await screen.findByRole("navigation")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Parear" })).toBeNull();
});

it("falls back to the app when the status request fails", async () => {
  mockFetch({
    "/api/lan/status": new WithStatus({}, 500),
    "/api/health": { status: "ok" },
    "/api/progress": progress,
  });
  renderWithProviders(<App />);
  expect(await screen.findByRole("navigation")).toBeTruthy();
});

it("goes back to the pairing page when any request answers 401", async () => {
  let statusCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/lan/status") {
        statusCalls += 1;
        // The first answer says paired; after the 401 the cookie is gone.
        return Response.json({ required: true, paired: statusCalls === 1 });
      }
      if (url === "/api/progress")
        return Response.json(
          { detail: "Pareie este celular." },
          { status: 401 },
        );
      return Response.json({ status: "ok" });
    }),
  );
  renderWithProviders(<App />);
  expect(await screen.findByRole("button", { name: "Parear" })).toBeTruthy();
  expect(statusCalls).toBe(2);
});

it("has a skip link and a title per page", async () => {
  mockFetch({
    "/api/lan/status": desktop,
    "/api/health": { status: "ok" },
    "/api/progress": progress,
    "/api/items?kind=letter": [],
  });
  renderWithProviders(<App />);
  const skip = await screen.findByRole("link", {
    name: "Pular para o conteúdo",
  });
  expect(skip.getAttribute("href")).toBe("#conteudo");
  expect(document.getElementById("conteudo")).toBeTruthy();
  expect(document.title).toBe("Ruvox");
  fireEvent.click(screen.getByRole("link", { name: "Jogar" }));
  await screen.findByRole("heading", { level: 1 });
  expect(document.title).toBe("Jogar · Ruvox");
});
