# Ruvox

Ruvox is a local-first desktop app in development for Brazilian Portuguese
speakers learning Russian. Lessons start with the Cyrillic alphabet and use
spaced repetition to practice letter sounds and word meanings offline. Planned
AI features include feedback on typed answers and exercises based on vocabulary
from songs the learner supplies.

## Stack

A Tauri 2 desktop window loads a React and TypeScript app built with Vite.
A local Python 3.12 sidecar runs FastAPI, serves the UI and stores progress
in SQLite using SQLModel and Alembic. The optional AI features use Agno.
See the [architecture decisions and roadmap](docs/PLAN.md).

## Development setup

P0-1 adds the repository documentation. The following commands apply once the
desktop scaffold lands in P0-4. Start in the repository root on Linux x86_64
with uv, Node.js 24, pnpm 11, stable Rust, Make and the
[Tauri Linux build dependencies](https://v2.tauri.app/start/prerequisites/#linux).

```sh
uv python install 3.12
uv sync --project backend --frozen
pnpm --dir frontend install --frozen-lockfile
make dev
```

`make dev` builds the frontend and opens the desktop window. Offline lessons
require no API key. The optional environment settings are listed in
[.env.example](.env.example).

## Checks

From P0-6 onward, run `make check` in the repository root to check all three
components. Individual checks become available with the backend in P0-2, the
frontend in P0-3 and the Tauri shell in P0-4. Each command and its working
directory are listed in the [quality gates](AGENTS.md#quality-gates).
