import type { components, paths } from "./schema";

type Schemas = components["schemas"];
type Health =
  paths["/api/health"]["get"]["responses"][200]["content"]["application/json"];
export type Item = Schemas["ItemOut"];
export type Progress = Schemas["ProgressOut"];
export type Question = Schemas["QuestionOut"];
export type Session = Schemas["SessionOut"];
export type SessionCreate = Schemas["SessionCreate"];
export type AnswerResult = Schemas["AnswerOut"];
export type FinishResult = Schemas["FinishOut"];

/** `status` is 0 when the request never reached the server. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new ApiError("Não foi possível falar com o serviço local.", 0);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : null;
    throw new ApiError(
      detail ?? "Falha ao consultar o serviço local.",
      response.status,
    );
  }
  return response.json();
}

const post = (body?: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const health = (signal?: AbortSignal) =>
  request<Health>("/api/health", { signal });

export const getProgress = (signal?: AbortSignal) =>
  request<Progress>("/api/progress", { signal });

export const getItems = (kind: string, signal?: AbortSignal) =>
  request<Item[]>(`/api/items?kind=${encodeURIComponent(kind)}`, { signal });

export const createSession = (body: SessionCreate) =>
  request<Session>("/api/sessions", post(body));

export const sendAnswer = (
  sessionId: number,
  body: { question_id: number; answer: string; time_ms: number },
) => request<AnswerResult>(`/api/sessions/${sessionId}/answers`, post(body));

export const finishSession = (sessionId: number) =>
  request<FinishResult>(`/api/sessions/${sessionId}/finish`, post());
