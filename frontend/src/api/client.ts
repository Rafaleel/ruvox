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
export type SettingsUpdate = Omit<Schemas["SettingsIn"], "providers"> & {
  providers?: Schemas["SettingsIn"]["providers"];
};
export type Provider = Schemas["ProviderOut"];
export type ModelOption = Schemas["ModelOption"];
export type ProviderModels = Schemas["ModelsOut"];
export type LlmTestResult = Schemas["LLMTestOut"];
export type Song = Schemas["SongOut"];
export type SongCreate = Schemas["SongIn"];
export type AnalyzedEntry = Schemas["AnalyzedEntry"];
export type SongAnalysis = Schemas["SongAnalysisOut"];
export type ConfirmEntry = Schemas["ConfirmEntry"];
export type ConfirmResult = Schemas["ConfirmOut"];
export type Stats = Schemas["StatsOut"];
export type LetterStatus = Schemas["LetterStatus"];

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

let onUnauthorized: (() => void) | undefined;

/** Called on any 401: this browser is not paired (or was unpaired). */
export const setUnauthorizedHandler = (handler?: () => void) => {
  onUnauthorized = handler;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new ApiError("Não foi possível falar com o serviço local.", 0);
  }
  if (!response.ok) {
    if (response.status === 401) onUnauthorized?.();
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

/** Every alphabet letter with its mastery status: the data behind the alphabet map. */
export const getLetterMap = (signal?: AbortSignal) =>
  request<LetterStatus[]>("/api/progress/letters", { signal });

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

/** Models the provider offers for a key; send `apiKey` to try one before saving it. */
export const listProviderModels = (providerId: string, apiKey?: string) =>
  request<ProviderModels>(
    `/api/settings/providers/${encodeURIComponent(providerId)}/models`,
    post(apiKey ? { api_key: apiKey } : {}),
  );

export const testProvider = (providerId: string) =>
  request<LlmTestResult>(
    "/api/settings/test-llm",
    post({ provider: providerId }),
  );

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

export const getStats = (signal?: AbortSignal) =>
  request<Stats>("/api/stats", { signal });

export type Lan = Schemas["LanOut"];

/** 403 means this page was opened from a phone: only the desktop manages LAN. */
export const getLan = (signal?: AbortSignal) =>
  request<Lan>("/api/lan", { signal });

export const setLan = (enabled: boolean) =>
  request<Lan>("/api/lan", send("PUT", { enabled }));

export const renewLanCode = () =>
  request<{ code: string | null }>("/api/lan/code", post());

export const unpairAll = () => request<void>("/api/lan/unpair", post());

/** The whole backup, as parsed JSON. */
export const exportBackup = () =>
  request<unknown>("/api/backup/export", post());

/** Row counts per table; a 422 carries the pt-BR reason in the error message. */
export const importBackup = (data: unknown) =>
  request<Record<string, number>>("/api/backup/import", post(data));

export const resetData = () => request<void>("/api/data/reset", post());

export type LanStatus = Schemas["LanStatus"];

export const getLanStatus = (signal?: AbortSignal) =>
  request<LanStatus>("/api/lan/status", { signal });

/** 204 sets the pairing cookie; 403 is a wrong code, 429 too many attempts. */
export const pairLan = (code: string) =>
  request<void>("/api/lan/pair", post({ code }));
