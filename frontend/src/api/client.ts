import type { paths } from "./schema";

type Health =
  paths["/api/health"]["get"]["responses"][200]["content"]["application/json"];

export async function health(signal?: AbortSignal): Promise<Health> {
  const response = await fetch("/api/health", { signal });
  if (!response.ok) throw new Error("Falha ao consultar o serviço local.");
  return response.json();
}
