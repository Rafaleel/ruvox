import { ApiError } from "../api/client";
import { Button } from "./Button";

export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409)
      return "Ainda não há nada para treinar. Volte mais tarde.";
    if (error.status === 0)
      return "Não foi possível falar com o serviço local. Verifique se o app está aberto e tente de novo.";
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
      className="grid gap-3 rounded-xl border border-danger p-4"
    >
      <p>{friendlyError(error)}</p>
      <Button variant="secondary" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
