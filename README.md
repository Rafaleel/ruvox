# Ruvox

Ruvox is a local-first desktop app for Brazilian Portuguese speakers learning
Russian. Lessons start with the Cyrillic alphabet and use spaced repetition.
Seven game modes work offline with no API key. With a key, AI agents plan
sessions, write questions, correct typed answers and extract vocabulary from
song lyrics you paste in. Lyrics never leave your computer. The phone can use
the app over the home Wi-Fi.

Using it: [user guide](docs/user-guide.md) (pt-BR), [phone access](docs/phone.md),
[LLM costs and models](docs/llm.md).

## Stack

A Tauri 2 desktop window loads a React and TypeScript app built with Vite.
A local Python 3.12 sidecar runs FastAPI, serves the UI and stores progress
in SQLite using SQLModel and Alembic. The optional AI features use Agno.
See the [architecture decisions and roadmap](docs/PLAN.md).

## Development setup

Start in the repository root on Linux x86_64
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

Run `make check` in the repository root to check the backend, frontend and Tauri
shell. Each command and its working directory are listed in the
[quality gates](AGENTS.md#quality-gates).

## Installers

`make release` builds the `.deb` and AppImage under
`src-tauri/target/release/bundle/` (it builds the frontend and the packaged Python
sidecar first). Pushing a tag such as `v0.1.0` runs the same build in GitHub Actions
and attaches the installers to a release.
