# Ruvox: conventions for coding agents

This file is identical in `CLAUDE.md` (Claude Code) and `AGENTS.md` (Codex). Keep them in sync.
Permanent rules live here. Current state and agent-to-agent messages live in `.ai/HANDOFF.md` (local, not versioned).

## Product

Mobile-first web app for Brazilian Portuguese speakers to learn Russian from zero. AI agents (Agno) plan sessions, generate questions, correct answers and extract vocabulary from user-pasted song lyrics. Game modes 1-3 (letter to sound, sound to letter, word to meaning) must work with no LLM.

## Language

- Code, comments, identifiers, commits, PR titles and bodies, issues, docs, ADRs and HANDOFF: **English**.
- User-facing UI text and exercise content: **Brazilian Portuguese** (Russian content with approximate pronunciation for Brazilians, e.g. "Привет (pri-VIÉT)").

## Stack and layout

- `backend/`: Python 3.12, FastAPI, Agno, Pydantic v2, SQLModel (SQLite), `uv`, `ruff`, `mypy`, `pytest`.
  - `app/agents` (planner, generator, corrector, music, team), `app/api`, `app/models`, `app/services` (spaced repetition, seed, no-LLM fallback), `tests/`.
- `frontend/`: Next.js App Router, TypeScript, Tailwind, `eslint`, `prettier`, `vitest`.
- `docs/adr/`: short architecture decision records.

## Rules for agents and the LLM layer

- Every agent output is structured (`response_model` with Pydantic). The frontend never parses free text.
- Agent prompts live in `backend/app/agents/prompts/`, versioned as files.
- Keep a provider abstraction so the LLM can be swapped. The model comes from `RUVOX_LLM_MODEL`.
- Log cost and latency of every LLM call.
- Mock the LLM in tests. Tests ship with each feature.
- Never bundle song lyrics. Lyrics stay in the user's local DB; exercises use single words and short excerpts.
- No secrets, `.env`, `*.db` files or `.ai/` in git.

## Git workflow

- `main` is protected: always stable, CI green. No direct pushes.
- Branch name: `<agent>/<type>/<short-description>`, e.g. `claude/feat/corrector-agent`, `codex/fix/alphabet-seed`. One task per branch, short-lived (at most a day of work).
- Before opening a PR: `git fetch && git rebase origin/main`. Never merge `main` into a branch. The PR author resolves conflicts by rebasing.
- Commits: Conventional Commits in English, `type(scope): imperative description`.
  Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `style`, `perf`.
  Small, atomic commits; each one builds and passes lint.
- PRs: title follows the commit format, use `.github/pull_request_template.md`, prefer under 400 lines, link the issue with `Closes #N`.
- The other agent reviews each PR and records a summary in HANDOFF. The owner gives final approval.
- Merge: squash merge only, with a Conventional Commits message. Delete the branch after merge.
- Push, PR and merge only with the owner's explicit authorization.

## HANDOFF protocol (`.ai/HANDOFF.md`)

- At the start of any task, read the whole file. Before the final commit, update it.
- Never delete history; only append or mark items done.
- Respect locks: never edit areas the other agent has locked under "In progress".
- Always cite branch, PR and files.

## Quality gates

Backend: `uv run ruff check . && uv run ruff format --check . && uv run mypy . && uv run pytest`.
Frontend: `pnpm lint && pnpm tsc --noEmit && pnpm test`.
Run them before declaring a task done.

## Default split

Claude: architecture, agents, review. Codex: frontend, tests, well-scoped queue tasks. Adjust via HANDOFF.
