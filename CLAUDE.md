# Ruvox: conventions for coding agents

This file is identical in `AGENTS.md` (Codex) and `CLAUDE.md` (Claude Code). Keep them in sync.
Permanent rules live here. The roadmap is in `docs/PLAN.md`. Current state and agent-to-agent messages live in `.ai/HANDOFF.md` (local, not versioned).

**At the start of any task:** read this file, `docs/PLAN.md`, and the whole `.ai/HANDOFF.md`.

## Product

Local-first desktop app (Tauri 2 window + Python FastAPI sidecar + SQLite) that teaches Russian to Brazilian Portuguese speakers from the Cyrillic alphabet. AI agents (Agno) plan sessions, generate questions, correct answers and extract vocabulary from song lyrics the user pastes in. Modes 1 to 3 must work with no LLM. Also reachable from the phone over the local network (opt-in, Phase 4). Architecture decisions are fixed in `docs/PLAN.md` section 2.

## Language

- Code, comments, identifiers, commits, PR titles and bodies, issues, docs, ADRs and HANDOFF: **English**.
- User-facing UI text and exercise content: **Brazilian Portuguese**, with Russian shown with an approximate pronunciation, e.g. "Привет (pri-VIÉT)".
- If you cannot tell which language to use for something, ask the owner before writing.

## Git and GitHub (the owner's global rules, binding for every agent)

These mirror the owner's global Claude instructions (`~/.claude/CLAUDE.md`, "Fluxo de git"). They are copied here because Codex cannot read that file.

- Work on a **branch per part of the work** (`feat/...`, `fix/...`, `docs/...`; also `chore/`, `ci/`, `test/`, `refactor/`). **Never commit directly to `main`.** Small follow-up requests on the same part reuse the same branch; do not stack one branch per request.
- Make **small, frequent local commits** while developing.
- **Push, PR and merge only with the owner's explicit authorization**, after a whole section is ready and verified. In `docs/PLAN.md`, one task (one PR) is one section: finish and verify the task, update HANDOFF, then stop and ask. Do not start a dependent task until the owner has merged the task it depends on.
- When creating a **new repository**, always ask the owner whether it should be private or public. Never assume.
- Commits and PRs use the repo's language (English).
- Commits: Conventional Commits, `type(scope): imperative description`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `style`, `perf`. Each commit builds and passes lint.
- PRs: title in the commit format, body from `.github/pull_request_template.md`, link the issue with `Closes #N`, prefer under 400 changed lines (lockfiles and generated files excluded). Merge is a squash merge. Branches are deleted after merge.
- Before opening a PR: `git fetch && git rebase origin/main`. Never merge `main` into a branch. The PR author resolves conflicts by rebasing.
- `main` stays stable with CI green.
- Never commit secrets, `.env`, `*.db`, `.ai/`, real song lyrics, or build output.

## Stack and layout

- `backend/`: Python 3.12, FastAPI, Pydantic v2, SQLModel (SQLite), Alembic, Agno (Phase 2), `uv`, `ruff`, `mypy` (strict), `pytest`.
- `frontend/`: Vite, React, TypeScript, Tailwind, React Router, TanStack Query, `eslint`, `prettier`, `vitest`. Types generated from the backend OpenAPI schema.
- `src-tauri/`: Rust, Tauri 2 shell that starts the backend sidecar.
- `docs/`: `PLAN.md` and short ADRs in `docs/adr/`.

## Rules for the agents and the LLM layer

- Every agent output is a structured Pydantic schema (in current Agno 3.x the parameter is `output_schema`; confirm in `docs/adr/0004`). The frontend never parses free text.
- Python validators check agent output; on failure retry once, then fall back to the no-LLM path.
- Agent prompts live in `backend/app/agents/prompts/` as versioned `.md` files.
- Keep a single provider seam (`agents/llm.py`). The model comes from settings.
- Log cost and latency of every LLM call.
- Mock the LLM in all tests. No network in tests. Tests ship with each feature.
- Never bundle song lyrics. Lyrics stay in the user's local DB; exercises use single words and short excerpts (at most 8 words).

## HANDOFF protocol (`.ai/HANDOFF.md`)

- At the start of a task, read the whole file. Before the final commit, update it.
- Never delete history; only append or mark items done.
- Respect locks: do not edit areas the other agent has locked under "In progress".
- Always cite branch, PR and files.

## Quality gates

Run before declaring a task done (once `make check` exists, use it):

- Backend (`backend/`): `uv run ruff check . && uv run ruff format --check . && uv run mypy . && uv run pytest`
- Frontend (`frontend/`): `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`
- Tauri (`src-tauri/`): `cargo clippy -- -D warnings && cargo test`

## Roles

Codex implements the tasks in `docs/PLAN.md`, in order. Claude handles architecture questions and reviews each PR. The owner gives final approval and decides push, PR and merge.
