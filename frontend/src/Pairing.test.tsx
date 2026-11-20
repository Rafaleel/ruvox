import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Pairing } from "./Pairing";
import { renderWithProviders } from "./test-utils";

const reload = vi.fn();
let pairResponse: () => Response;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  reload.mockClear();
  fetchMock = vi.fn(async () => pairResponse());
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { reload });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const type = (value: string) =>
  fireEvent.change(screen.getByLabelText("Código de pareamento"), {
    target: { value },
  });
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Parear" }));

it("explains where to find the code and asks for six digits", () => {
  renderWithProviders(<Pairing />);
  expect(
    screen.getByText(
      /Digite o código de 6 dígitos mostrado no computador \(Configurações > Acesso pelo celular\)/,
    ),
  ).toBeTruthy();
  const input = screen.getByLabelText("Código de pareamento");
  expect(input.getAttribute("inputmode")).toBe("numeric");
  expect(input.getAttribute("autocomplete")).toBe("one-time-code");
  expect(input.getAttribute("maxlength")).toBe("6");
});

it("keeps only digits and enables the button at six", () => {
  renderWithProviders(<Pairing />);
  const button = screen.getByRole("button", { name: "Parear" });
  type("12a3-45");
  expect(
    (screen.getByLabelText("Código de pareamento") as HTMLInputElement).value,
  ).toBe("12345");
  expect((button as HTMLButtonElement).disabled).toBe(true);
  type("123456");
  expect((button as HTMLButtonElement).disabled).toBe(false);
});

it("reloads the app when the code is accepted (204)", async () => {
  pairResponse = () => new Response(null, { status: 204 });
  renderWithProviders(<Pairing />);
  type("123456");
  submit();
  await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/lan/pair");
  expect(JSON.parse(init.body)).toEqual({ code: "123456" });
});

it("says the code is wrong on 403", async () => {
  pairResponse = () =>
    Response.json({ detail: "Código incorreto." }, { status: 403 });
  renderWithProviders(<Pairing />);
  type("000000");
  submit();
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Código incorreto.",
  );
  expect(reload).not.toHaveBeenCalled();
});

it("shows the backend message when rate limited (429)", async () => {
  pairResponse = () =>
    Response.json(
      { detail: "Muitas tentativas. Espere um minuto e tente de novo." },
      { status: 429 },
    );
  renderWithProviders(<Pairing />);
  type("000000");
  submit();
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Muitas tentativas. Espere um minuto e tente de novo.",
  );
});
