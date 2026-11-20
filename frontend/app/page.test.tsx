import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

test("shows the app title", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { name: "Ruvox" })).toBeTruthy();
});
