import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Flame } from "lucide-react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { Button, buttonClasses } from "./Button";
import { Card } from "./Card";
import { Field, Input, Select, Textarea } from "./Field";
import { Icon } from "./Icon";
import { LetterCard } from "./LetterCard";
import { Notice } from "./Notice";
import { PageHeader } from "./PageHeader";
import { ProgressRing } from "./ProgressRing";
import { Segmented } from "./Segmented";
import { Stat } from "./Stat";
import { Switch } from "./Switch";

afterEach(cleanup);

it("Button defaults to type=button and keeps working for links via buttonClasses", () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Salvar</Button>);
  const button = screen.getByRole("button", { name: "Salvar" });
  expect(button.getAttribute("type")).toBe("button");
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
  expect(buttonClasses()).toContain("bg-accent");
  expect(buttonClasses("secondary", "lg")).toContain("min-h-13");
});

it("Button in the loading state is disabled and busy", () => {
  const onClick = vi.fn();
  render(
    <Button loading onClick={onClick}>
      Salvando
    </Button>,
  );
  const button = screen.getByRole("button", { name: "Salvando" });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(button.getAttribute("aria-busy")).toBe("true");
  fireEvent.click(button);
  expect(onClick).not.toHaveBeenCalled();
});

it("Icon is hidden from screen readers unless it has a label", () => {
  const { container } = render(
    <>
      <Icon icon={Flame} />
      <Icon icon={Flame} label="Sequência" />
    </>,
  );
  const [decorative, named] = Array.from(container.querySelectorAll("svg"));
  expect(decorative.getAttribute("aria-hidden")).toBe("true");
  expect(named.getAttribute("aria-hidden")).toBeNull();
  expect(screen.getByRole("img", { name: "Sequência" })).toBeTruthy();
  expect(decorative.getAttribute("stroke-width")).toBe("1.75");
});

it("Card shows the margin rule only when asked", () => {
  const { container } = render(
    <>
      <Card>a</Card>
      <Card margin>b</Card>
    </>,
  );
  const [plain, ruled] = Array.from(container.children);
  expect(plain.className).not.toContain("margin-rule");
  expect(ruled.className).toContain("margin-rule");
});

it("Field wires the label, help and error to the control", () => {
  render(
    <Field label="Chave" help="Cole aqui" error="Chave recusada">
      {(control) => <input {...control} />}
    </Field>,
  );
  const input = screen.getByLabelText("Chave");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  const described = input.getAttribute("aria-describedby")!.split(" ");
  expect(described).toHaveLength(2);
  expect(document.getElementById(described[0])!.textContent).toBe("Cole aqui");
  expect(screen.getByRole("alert").textContent).toBe("Chave recusada");
});

it("Input, Select and Textarea render a labelled control", () => {
  render(
    <>
      <Input label="Nome" />
      <Select label="Modelo">
        <option>a</option>
      </Select>
      <Textarea label="Letra" help="Até 20 mil caracteres" />
    </>,
  );
  expect(screen.getByLabelText("Nome").tagName).toBe("INPUT");
  expect(screen.getByLabelText("Modelo").tagName).toBe("SELECT");
  const area = screen.getByLabelText("Letra");
  expect(area.tagName).toBe("TEXTAREA");
  expect(area.getAttribute("aria-invalid")).toBeNull();
  expect(area.getAttribute("aria-describedby")).toBeTruthy();
});

it("Input without a label is a bare control", () => {
  render(<Input aria-label="Busca" />);
  expect(screen.getByRole("textbox", { name: "Busca" })).toBeTruthy();
});

it("Switch toggles through aria-checked", () => {
  function Demo() {
    const [on, setOn] = useState(false);
    return <Switch aria-label="Celular" checked={on} onCheckedChange={setOn} />;
  }
  render(<Demo />);
  const toggle = screen.getByRole("switch", { name: "Celular" });
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-checked")).toBe("true");
});

it("Segmented is a radio group that moves with the arrow keys", () => {
  const onChange = vi.fn();
  render(
    <Segmented
      label="Modo"
      value="a"
      onChange={onChange}
      options={[
        { value: "a", label: "Cartas" },
        { value: "b", label: "Digitar" },
        { value: "c", label: "Pares" },
      ]}
    />,
  );
  expect(screen.getByRole("radiogroup", { name: "Modo" })).toBeTruthy();
  const [first, second] = screen.getAllByRole("radio");
  expect(first.getAttribute("aria-checked")).toBe("true");
  expect(first.tabIndex).toBe(0);
  expect(second.tabIndex).toBe(-1);
  fireEvent.keyDown(first, { key: "ArrowRight" });
  expect(onChange).toHaveBeenLastCalledWith("b");
  fireEvent.keyDown(first, { key: "ArrowLeft" });
  expect(onChange).toHaveBeenLastCalledWith("c");
  fireEvent.click(second);
  expect(onChange).toHaveBeenLastCalledWith("b");
});

it("Notice announces danger as an alert and the rest as status", () => {
  render(
    <>
      <Notice tone="danger" title="Falhou">
        Tente de novo
      </Notice>
      <Notice tone="success">Salvo</Notice>
    </>,
  );
  expect(screen.getByRole("alert").textContent).toContain("Falhou");
  expect(screen.getByRole("status").textContent).toBe("Salvo");
});

it("ProgressRing has an accessible label and clamps overflow", () => {
  const { container } = render(
    <>
      <ProgressRing value={2} total={5} label="Grupo 1" />
      <ProgressRing value={9} total={5} />
      <ProgressRing value={0} total={0} />
    </>,
  );
  expect(screen.getByRole("img", { name: "Grupo 1" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "9 de 5" })).toBeTruthy();
  const [partial, full, empty] = Array.from(
    container.querySelectorAll("svg"),
  ).map((svg) => svg.querySelectorAll("circle"));
  expect(partial).toHaveLength(2);
  expect(full[1].getAttribute("stroke-dashoffset")).toBe("0");
  expect(empty).toHaveLength(1);
});

it("PageHeader renders the title as the h1 with eyebrow, description and action", () => {
  render(
    <PageHeader
      eyebrow="Hoje"
      title="Olá"
      description="Vamos praticar?"
      action={<button>Ir</button>}
    />,
  );
  expect(screen.getByRole("heading", { level: 1, name: "Olá" })).toBeTruthy();
  expect(screen.getByText("Hoje")).toBeTruthy();
  expect(screen.getByText("Vamos praticar?")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Ir" })).toBeTruthy();
});

it("Stat shows label, value and hint", () => {
  render(<Stat label="Sequência" value={3} hint="melhor: 5" tone="gold" />);
  expect(screen.getByText("Sequência")).toBeTruthy();
  expect(screen.getByText("3")).toBeTruthy();
  expect(screen.getByText("melhor: 5")).toBeTruthy();
});

it("LetterCard shows upper and lower case and the pronunciation", () => {
  render(<LetterCard letter="Ч" pronunciation="tch" />);
  expect(screen.getByText("Ч")).toBeTruthy();
  expect(screen.getByText("ч")).toBeTruthy();
  expect(screen.getByText("tch")).toBeTruthy();
});
