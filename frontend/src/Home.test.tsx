import { cleanup, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Home } from "./Home";
import {
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
    });
    renderWithProviders(<Home />);
    expect(screen.getByRole("heading", { name: "Ruvox" })).toBeTruthy();
    expect(await screen.findByText(message)).toBeTruthy();
  },
);

it("shows due count, group progress and words unlocked", async () => {
  mockFetch({ "/api/health": { status: "ok" }, "/api/progress": progress });
  renderWithProviders(<Home />);

  expect(
    await screen.findByText("para revisar agora", { exact: false }),
  ).toBeTruthy();
  expect(screen.getByText("3")).toBeTruthy();
  expect(screen.getByText("2/5")).toBeTruthy();
  expect(screen.getByText("0/8")).toBeTruthy();
  expect(screen.getByText("1/20")).toBeTruthy();
  expect(screen.getByText("12/40")).toBeTruthy();
  const bar = screen.getByRole("progressbar", { name: "Grupo 1" });
  expect(bar.getAttribute("aria-valuenow")).toBe("2");
  expect(
    screen.getByRole("link", { name: "Jogar agora" }).getAttribute("href"),
  ).toBe("/play");
});

it("shows the streak badge and a visible alphabet link", async () => {
  mockFetch({
    "/api/health": { status: "ok" },
    "/api/progress": progress,
    "/api/stats": stats,
  });
  renderWithProviders(<Home />);
  const badge = await screen.findByRole("link", { name: /Sequência: 1 dia/ });
  expect(badge.getAttribute("href")).toBe("/progress");
  expect(
    screen.getByRole("link", { name: /Alfabeto/ }).getAttribute("href"),
  ).toBe("/alphabet");
});

it("hides the streak badge when stats fail", async () => {
  mockFetch({
    "/api/health": { status: "ok" },
    "/api/progress": progress,
    "/api/stats": new WithStatus({}, 500),
  });
  renderWithProviders(<Home />);
  expect(await screen.findByText("Seu progresso")).toBeTruthy();
  expect(screen.queryByText(/Sequência/)).toBeNull();
});

it("offers a retry when progress fails to load", async () => {
  mockFetch({
    "/api/health": { status: "ok" },
    "/api/progress": new WithStatus({}, 500),
  });
  renderWithProviders(<Home />);
  expect(
    await screen.findByRole("button", { name: "Tentar de novo" }),
  ).toBeTruthy();
});
