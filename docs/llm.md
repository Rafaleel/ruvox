# LLM layer

Ruvox calls Claude through Agno. Everything goes through one seam,
`backend/app/agents/llm.py` (`StructuredLLM`). With no API key the app runs in
offline mode: modes 1 to 4 work on seeded content and no model is called.

## Which model

Set the model on the Settings screen, or with `RUVOX_LLM_MODEL`. The default is
`claude-sonnet-5-5`. The API key lives in `<data dir>/config.json` (mode 0600) or in
`ANTHROPIC_API_KEY`, which wins over the file.

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
list prices). Add a row there when you switch to a model that is not listed;
unlisted models are logged with cost 0.

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
```

## Tests

Tests never touch the network: `tests/fakes.py` provides `FakeLLM`, and the API tests
override `llm_dependency`.
