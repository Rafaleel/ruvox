import { useId, type ReactNode } from "react";
import { Button } from "./Button";

/** Inline confirmation: the safe choice (Cancelar) has focus, Escape cancels. */
export function ConfirmPanel({
  title,
  children,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  return (
    <div
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className="rise mt-1 grid gap-2 rounded-card border-l-[3px] border-danger bg-sheet-2 p-4 shadow-[inset_0_0_0_1px_var(--hairline)]"
    >
      <p id={`${id}-title`} className="font-semibold text-danger">
        {title}
      </p>
      <div id={`${id}-body`}>{children}</div>
      <div className="mt-1 flex flex-wrap gap-2">
        <Button variant="secondary" autoFocus onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="danger" disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
