# ADR 0006: Several AI providers, all through Agno

Accepted. Replaces the first version of this ADR, which used LangChain for OpenAI and
Groq and kept Agno only for Claude.

Ruvox accepts keys for Anthropic (Claude), OpenAI (ChatGPT) and Groq. Everything the
agents need is the single `StructuredLLM` seam (`backend/app/agents/llm.py`), and a single
implementation, `AgnoLLM`, serves all three providers.

- **One library.** Agno already has a model class per provider (`Claude`, `OpenAIChat`,
  `Groq`) and one way to ask for a structure (`output_schema`). Using it for everything
  avoids two code paths that do the same job. LangChain was tried first and removed.
- **Structured output modes.** Claude uses its native structured output. OpenAI and Groq try
  the provider's native structured output first and, if the model rejects it, JSON mode
  (`use_json_mode`). The mode that worked is remembered per model. Only failures that mean
  "this model cannot do that mode" fall through; a refused key, a rate limit or a timeout
  is reported at once.
- **Model names are never typed or guessed.** The Settings screen lists the models by
  calling each provider's own models endpoint with the learner's key (OpenAI and Groq
  lists are filtered to chat models). Claude also has a short built-in list, from
  Anthropic's published table, shown before a key exists. A provider without a chosen
  model stays offline.
- **Settings shape**: `active_provider` plus `providers.<id>.{api_key, model}`; the old
  flat `api_key`/`model` file is read as the Anthropic provider. The API reports only
  whether a key exists, never the key. The active provider must have a key and a model.
- **Errors**: API failures from any provider become the same pt-BR messages
  (`friendly_error`, naming the right provider) and keys are removed from any error text
  before it is logged or stored. Model-list failures are HTTP 400, never 401, because the
  app uses 401 to mean "this phone must pair".
- **Cost**: prices are known only for the Claude models in `PRICES_PER_MTOK`; other
  providers log tokens and latency with cost 0 instead of an invented price. The `llmcall`
  model column reads `provider:model`.

Adding a provider is one entry in `providers.py` (name, models endpoint) and one branch in
`build_model` in `llm.py`, if Agno has a model class for it.
