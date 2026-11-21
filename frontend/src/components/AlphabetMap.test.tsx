import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  letterMap,
  mockFetch,
  renderWithProviders,
  WithStatus,
} from "../test-utils";
import { AlphabetMap } from "./AlphabetMap";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows 33 tiles in three groups, each a link with its status in the name", async () => {
  mockFetch({ "/api/progress/letters": letterMap });
  renderWithProviders(<AlphabetMap />);

  const tile = await screen.findByRole("link", { name: "А: dominada" });
  expect(tile.getAttribute("href")).toBe("/alphabet#letra-1");
  expect(screen.getAllByRole("link")).toHaveLength(33);
  expect(
    screen.getByRole("link", { name: "Ч: nova" }).getAttribute("href"),
  ).toBe("/alphabet#letra-24");
  const group2 = screen.getByRole("list", {
    name: "Grupo 2: parecem latinas, mas soam diferente",
  });
  expect(within(group2).getAllByRole("listitem")).toHaveLength(8);
});

it("gives a text alternative with the count per status", async () => {
  mockFetch({ "/api/progress/letters": letterMap });
  renderWithProviders(<AlphabetMap />);
  expect(
    await screen.findByText(
      "Mapa do alfabeto, 33 letras: 19 novas, 7 aprendendo, 5 familiares, 2 dominadas.",
    ),
  ).toBeTruthy();
});

it("describes the letter under the pointer", async () => {
  mockFetch({ "/api/progress/letters": letterMap });
  renderWithProviders(<AlphabetMap />);
  fireEvent.mouseEnter(
    await screen.findByRole("link", { name: "Б: dominada" }),
  );
  expect(screen.getByText("som 2")).toBeTruthy();
});

it("offers a retry when the map fails to load", async () => {
  mockFetch({ "/api/progress/letters": new WithStatus({}, 500) });
  renderWithProviders(<AlphabetMap />);
  expect(
    await screen.findByRole("button", { name: "Tentar de novo" }),
  ).toBeTruthy();
});
