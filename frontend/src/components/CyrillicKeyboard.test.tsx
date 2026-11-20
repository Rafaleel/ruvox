import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { CyrillicKeyboard } from "./CyrillicKeyboard";

afterEach(cleanup);

function Harness() {
  const [text, setText] = useState("");
  return (
    <>
      <output aria-label="texto">{text}</output>
      <CyrillicKeyboard
        onKey={(l) => setText((t) => t + l)}
        onSpace={() => setText((t) => t + " ")}
        onBackspace={() => setText((t) => t.slice(0, -1))}
      />
    </>
  );
}

it("renders the 33 Russian letters plus space and backspace", () => {
  render(<Harness />);
  const keys = screen.getAllByRole("button");
  expect(keys).toHaveLength(35);
  const letters = keys.slice(0, 33).map((k) => k.textContent);
  expect(new Set(letters).size).toBe(33);
  expect(letters.join("")).toBe("йцукенгшщзхъфывапролджэячсмитьбюё");
  expect(screen.getByRole("button", { name: "espaço" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "apagar" })).toBeTruthy();
});

it("types letters, space and backspace", () => {
  render(<Harness />);
  for (const name of ["п", "р", "и", "espaço", "в", "apagar"])
    fireEvent.click(screen.getByRole("button", { name }));
  expect(screen.getByLabelText("texto").textContent).toBe("при ");
});
