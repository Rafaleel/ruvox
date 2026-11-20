# ADR 0001: Stack and repository conventions

Date: 2026-11-20. Status: accepted.

## Decision

- Backend: Python 3.12, FastAPI, Agno for agents, Pydantic v2, SQLModel on SQLite (easy move to Postgres).
- Frontend: Next.js App Router, TypeScript, Tailwind. Fall back to Streamlit only if Next.js slows the MVP.
- LLM: Claude through the Anthropic API, model from `RUVOX_LLM_MODEL`, behind a provider abstraction.
- Game modes 1-3 run on seeded content with no LLM, as the fallback when the API is down or unconfigured.
- Code, commits, PRs and docs are in English; only the product UI and exercise content are in Brazilian Portuguese.
- Squash merge into a protected `main`. Branch protection requires a PR and green CI, with 0 required approvals, because the owner is the only GitHub account on the repo. The cross-agent review is recorded in HANDOFF.

## Why

Simplest options that meet the MVP goals and keep the LLM provider and the database replaceable.
