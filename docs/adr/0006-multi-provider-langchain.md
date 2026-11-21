# ADR 0006: Several AI providers, LangChain for the new ones

Accepted.

Ruvox accepts keys for Anthropic (Claude), OpenAI (ChatGPT) and Groq. Everything the
agents need is still the single `StructuredLLM` seam (`backend/app/agents/llm.py`).

- **Anthropic** keeps the Agno implementation (`AgnoLLM`) that was already tested.
- **OpenAI and Groq** use LangChain (`LangChainLLM`): `ChatOpenAI` and `ChatGroq` with
  `with_structured_output`. A structured-output method a model rejects (`json_schema`,
  then `function_calling`) is skipped, and the one that worked is remembered per model.
  Adding a provider is one entry in `providers.py` and one branch in `build_chat_model`.
- **Model names are never typed or guessed.** The Settings screen lists the models by
  calling each provider's own models endpoint with the learner's key (OpenAI and Groq
  lists are filtered to chat models). Claude also has a short built-in list, from
  Anthropic's published table, shown before a key exists. A provider without a chosen
  model stays offline.
- **Settings shape**: `active_provider` plus `providers.<id>.{api_key, model}`; the old
  flat `api_key`/`model` file is read as the Anthropic provider. The API reports only
  whether a key exists, never the key.
- **Errors**: API failures from any provider become the same pt-BR messages
  (`friendly_error`). Model-list failures are HTTP 400, never 401, because the app uses
  401 to mean "this phone must pair".
- **Cost**: prices are known only for the Claude models in `PRICES_PER_MTOK`; other
  providers log tokens and latency with cost 0 instead of an invented price.
