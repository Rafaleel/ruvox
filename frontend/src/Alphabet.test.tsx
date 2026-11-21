import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Alphabet } from "./Alphabet";
import { letterMap, mockFetch, renderWithProviders } from "./test-utils";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// 33 letters: 5 + 8 + 20 across the three groups; "Ч" (24th) is in group 3.
const letters = Array.from({ length: 33 }, (_, i) => {
  const group = i < 5 ? 1 : i < 13 ? 2 : 3;
  return {
    id: i + 1,
    kind: "letter",
    text: i === 32 ? "Ё" : String.fromCharCode(0x410 + i),
    pronunciation: `som ${i + 1}`,
    meaning: "",
    source: "seed",
    group,
    difficulty: 1,
  };
});

it("renders 33 letters grouped under the three titles", async () => {
  mockFetch({ "/api/items?kind=letter": letters });
  renderWithProviders(<Alphabet />);

  expect(await screen.findAllByRole("listitem")).toHaveLength(33);
  const titles = screen
    .getAllByRole("heading", { level: 2 })
    .map((h) => h.textContent);
  expect(titles).toEqual([
    "Grupo 1: iguais ao português",
    "Grupo 2: parecem latinas, mas soam diferente",
    "Grupo 3: letras novas",
  ]);
  const group3 = screen
    .getByRole("heading", { name: /Grupo 3/ })
    .closest("section")!;
  expect(within(group3).getAllByRole("listitem")).toHaveLength(20);
  expect(within(group3).getByText("Ч")).toBeTruthy();
  expect(within(group3).getByText("ч")).toBeTruthy();
  expect(within(group3).getByText("som 24")).toBeTruthy();
});

it("shows each letter's mastery as a word and a ring per group", async () => {
  mockFetch({
    "/api/items?kind=letter": letters,
    "/api/progress/letters": letterMap,
  });
  // jsdom has no scrolling; the page scrolls to the card the hash points at.
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  renderWithProviders(<Alphabet />, "/alphabet#letra-1");
  await screen.findAllByRole("listitem");
  const card = document.getElementById("letra-1")!;
  expect(scroll).toHaveBeenCalled();
  expect(document.activeElement).toBe(card);
  expect(card.className).toContain("ring-accent");
  expect(within(card).getByText("dominada")).toBeTruthy();
  expect(within(card).getByText("som 1")).toBeTruthy();
  expect(
    screen.getByRole("img", { name: "2 de 5 letras dominadas" }),
  ).toBeTruthy();
});
