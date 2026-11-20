import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Home } from "./Home";

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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ status: "ok" }, { status })),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Home />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("heading", { name: "Ruvox" })).toBeTruthy();
    expect(await screen.findByText(message)).toBeTruthy();
  },
);
