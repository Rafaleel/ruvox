import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";
import { YourData } from "./YourData";

// jsdom has no Blob.text(); browsers do.
if (!Blob.prototype.text) {
  Blob.prototype.text = function (this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

type Route = (init?: RequestInit) => Response;
let routes: Record<string, Route>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  routes = {};
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const route = routes[`${init?.method ?? "GET"} ${url}`];
    if (!route) throw new Error(`unexpected request ${url}`);
    return route(init);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const called = (url: string) =>
  fetchMock.mock.calls.filter(([u]) => u === url).length;

const chooseFile = (content: string) =>
  fireEvent.change(screen.getByLabelText("Arquivo de backup"), {
    target: {
      files: [new File([content], "b.json", { type: "application/json" })],
    },
  });

it("exports the backup as ruvox-backup.json through a temporary link", async () => {
  routes["POST /api/backup/export"] = () => Response.json({ version: 1 });
  const createObjectURL = vi.fn(() => "blob:fake");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL, revokeObjectURL }),
  );
  const clicked: HTMLAnchorElement[] = [];
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });

  renderWithProviders(<YourData />);
  fireEvent.click(screen.getByRole("button", { name: "Exportar backup" }));

  expect(await screen.findByText("Backup exportado.")).toBeTruthy();
  expect(clicked).toHaveLength(1);
  expect(clicked[0].download).toBe("ruvox-backup.json");
  expect(clicked[0].href).toBe("blob:fake");
  expect(document.querySelector("a[download]")).toBeNull();
  const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
  expect(JSON.parse(await blob.text())).toEqual({ version: 1 });
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  click.mockRestore();
});

it("imports only after a confirmation that says it replaces everything", async () => {
  routes["POST /api/backup/import"] = () =>
    Response.json({
      songs: 2,
      items: 5,
      sessions: 3,
      attempts: 40,
      review_states: 4,
    });
  renderWithProviders(<YourData />);

  chooseFile('{"version": 1}');
  expect(await screen.findByRole("alertdialog")).toBeTruthy();
  expect(screen.getByText(/SUBSTITUI todo o seu progresso/)).toBeTruthy();
  expect(called("/api/backup/import")).toBe(0);

  fireEvent.click(
    screen.getByRole("button", { name: "Substituir meus dados" }),
  );
  expect(
    await screen.findByText(
      "Backup importado: 2 músicas, 5 itens, 3 sessões, 40 respostas.",
    ),
  ).toBeTruthy();
  const init = fetchMock.mock.calls.find(
    ([u]) => u === "/api/backup/import",
  )![1];
  expect(JSON.parse(init.body)).toEqual({ version: 1 });
});

it("does nothing when the import is cancelled", async () => {
  renderWithProviders(<YourData />);
  chooseFile("{}");
  fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(called("/api/backup/import")).toBe(0);
});

it("shows the backend reason when the backup is rejected (422)", async () => {
  routes["POST /api/backup/import"] = () =>
    Response.json(
      { detail: "Este backup é de uma versão que o app não conhece." },
      { status: 422 },
    );
  renderWithProviders(<YourData />);
  chooseFile("{}");
  fireEvent.click(
    await screen.findByRole("button", { name: "Substituir meus dados" }),
  );
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Este backup é de uma versão que o app não conhece.",
  );
});

it("rejects a file that is not JSON without calling the API", async () => {
  renderWithProviders(<YourData />);
  chooseFile("not json");
  expect((await screen.findByRole("alert")).textContent).toMatch(/JSON/);
  expect(called("/api/backup/import")).toBe(0);
});

it("resets only after a confirmation naming what is erased and what stays", async () => {
  routes["POST /api/data/reset"] = () => new Response(null, { status: 204 });
  renderWithProviders(<YourData />);

  fireEvent.click(screen.getByRole("button", { name: "Apagar meu progresso" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog.textContent).toContain(
    "progresso, suas sessões e suas músicas",
  );
  expect(dialog.textContent).toContain("configurações e a chave da API");
  expect(called("/api/data/reset")).toBe(0);

  fireEvent.click(screen.getByRole("button", { name: "Apagar tudo" }));
  expect(await screen.findByText("Progresso apagado.")).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(called("/api/data/reset")).toBe(1);
});
