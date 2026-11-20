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
export type Settings = Schemas["SettingsOut"];
export type SettingsUpdate = Schemas["SettingsIn"];
export type LlmTestResult = Schemas["LLMTestOut"];
export type Song = Schemas["SongOut"];
export type SongCreate = Schemas["SongIn"];
export type AnalyzedEntry = Schemas["AnalyzedEntry"];
export type SongAnalysis = Schemas["SongAnalysisOut"];
export type ConfirmEntry = Schemas["ConfirmEntry"];
export type ConfirmResult = Schemas["ConfirmOut"];

/** Mirrors the backend limit; the API answers 413 above it. */
export const MAX_LYRICS_CHARS = 20000;

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
  return response.status === 204 ? (undefined as T) : response.json();
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const post = (body?: unknown) => send("POST", body);

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

export const getSettings = (signal?: AbortSignal) =>
  request<Settings>("/api/settings", { signal });

export const putSettings = (body: SettingsUpdate) =>
  request<Settings>("/api/settings", send("PUT", body));

export const testLlm = () =>
  request<LlmTestResult>("/api/settings/test-llm", post());

export const getSongs = (signal?: AbortSignal) =>
  request<Song[]>("/api/songs", { signal });

export const getSong = (id: number, signal?: AbortSignal) =>
  request<Song>(`/api/songs/${id}`, { signal });

export const createSong = (body: SongCreate) =>
  request<Song>("/api/songs", post(body));

export const deleteSong = (id: number) =>
  request<void>(`/api/songs/${id}`, { method: "DELETE" });

export const analyzeSong = (id: number) =>
  request<SongAnalysis>(`/api/songs/${id}/analyze`, post());

export const confirmSong = (id: number, entries: ConfirmEntry[]) =>
  request<ConfirmResult>(`/api/songs/${id}/confirm`, post({ entries }));
