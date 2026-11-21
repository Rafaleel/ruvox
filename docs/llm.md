# LLM layer

Ruvox calls Claude through Agno. Everything goes through one seam,
`backend/app/agents/llm.py` (`StructuredLLM`). With no API key the app runs in
offline mode: modes 1 to 4 work on seeded content and no model is called.

## Providers and models

Ruvox can use three providers; each key is labelled with the AI it belongs to:

| Provider | Brand | Agno model class | Key environment variable |
| --- | --- | --- | --- |
| Anthropic | Claude | `Claude` | `ANTHROPIC_API_KEY` |
| OpenAI | ChatGPT | `OpenAIChat` | `OPENAI_API_KEY` |
| Groq | Groq | `Groq` | `GROQ_API_KEY` |

All three run through Agno (see ADR 0006).

On the Settings screen you save a key per provider, choose the model from the list the
provider itself returns for that key (names are never typed by hand), and pick which
provider is active. Only Claude has a default model; for OpenAI and Groq a key without a
chosen model keeps the app offline. Keys live in `<data dir>/config.json` (mode 0600);
the environment variables win over the file, and `RUVOX_LLM_PROVIDER` / `RUVOX_LLM_MODEL`
override the active provider and its model. Settings saved by older versions (one flat key
and model) are read as the Anthropic provider.

Adding another provider is one entry in `app/agents/providers.py` (name, models endpoint)
and one branch in `build_model` in `app/agents/llm.py`.

## What gets called

| Agent | When | Calls per session |
| --- | --- | --- |
| planner | session start, only with a key | 1 |
| generator | session start, after a usable plan | 1 |
| corrector | a typed answer that is not an exact match | 1 per such answer |
| music | when you analyze a pasted song | 1 per song |

Exact typed matches (case, ё/е, stress marks) never call a model. Every output is a
validated schema; unusable output is retried once and then replaced by the offline
path.

## Cost and latency

Each call writes one row to the `llmcall` table (agent, model, tokens, latency, cost,
ok, error) and one log line `llm_call agent=... latency_ms=... cost_usd=...`.
Cost comes from `PRICES_PER_MTOK` in `llm.py` (USD per million tokens, first-party
list prices, Claude only). Models that are not listed, including every OpenAI and Groq
model, are logged with tokens and latency but cost 0: add a row once you know the price.
The `model` column reads `provider:model`.

```sql
select agent, count(*), round(sum(cost_usd), 4), round(avg(latency_ms))
from llmcall group by agent;
```

## Live smoke test

Runs each agent once against the real API in a throwaway data directory, and prints
latency and cost. Never run by CI.

```bash
cd backend
RUVOX_LIVE_LLM=1 ANTHROPIC_API_KEY=sk-ant-... uv run python -m app.live_smoke
# or another provider:
RUVOX_LIVE_LLM=1 RUVOX_LLM_PROVIDER=openai OPENAI_API_KEY=sk-... \
  RUVOX_LLM_MODEL=<an id from Settings> uv run python -m app.live_smoke
```

## Tests

Tests never touch the network: `tests/fakes.py` provides `FakeLLM`, and the API tests
override `llm_dependency`.
