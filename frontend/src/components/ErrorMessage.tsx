import { CircleAlert, RotateCw } from "lucide-react";
import { ApiError } from "../api/client";
import { Button } from "./Button";
import { Icon } from "./Icon";

export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0)
      return "Não foi possível falar com o serviço local. Verifique se o app está aberto e tente de novo.";
    // The backend `detail` is already pt-BR (e.g. 409 "Ainda não há nada para treinar").
    return error.message;
  }
  return "Algo deu errado. Tente de novo.";
}

export function ErrorMessage({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="grid gap-3 rounded-card bg-danger-soft p-4 shadow-[inset_0_0_0_1px_var(--danger)]"
    >
      <p className="flex gap-2.5 text-ink">
        <Icon icon={CircleAlert} className="mt-0.5 shrink-0 text-danger" />
        <span>{friendlyError(error)}</span>
      </p>
      <Button variant="secondary" icon={RotateCw} onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
