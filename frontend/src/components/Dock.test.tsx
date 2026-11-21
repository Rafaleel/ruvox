import { cleanup, fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { renderWithProviders } from "../test-utils";
import { Dock } from "./Dock";
import { DockProvider, useHideDock } from "./DockProvider";

afterEach(cleanup);

function Session() {
  useHideDock();
  return <p>sessão</p>;
}

/** A screen that can end its session, as Result does. */
function Screen() {
  const [running, setRunning] = useState(true);
  return running ? (
    <>
      <Session />
      <button onClick={() => setRunning(false)}>terminar</button>
    </>
  ) : null;
}

it("keeps exactly five links and marks the current route", () => {
  renderWithProviders(
    <DockProvider>
      <Dock />
    </DockProvider>,
    "/progress",
  );
  const nav = screen.getByRole("navigation", { name: "Navegação principal" });
  expect(nav.querySelectorAll("a")).toHaveLength(5);
  expect(
    screen
      .getByRole("link", { name: "Progresso" })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(nav.hasAttribute("inert")).toBe(false);
});

it("is inert while a screen asks to hide it and comes back after", () => {
  renderWithProviders(
    <DockProvider>
      <Dock />
      <Screen />
    </DockProvider>,
  );
  expect(document.querySelector("nav")!.hasAttribute("inert")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "terminar" }));
  expect(document.querySelector("nav")!.hasAttribute("inert")).toBe(false);
});

it("does nothing outside a provider", () => {
  renderWithProviders(<Session />);
  expect(screen.getByText("sessão")).toBeTruthy();
});
