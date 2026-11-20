# ADR 0001 — Desktop stack

Accepted under D1–D3, D10 and D16 in the [project plan](../PLAN.md).

Ruvox needs to run lessons offline, keep learner progress across upgrades and
support optional Agno agents in Python. Linux x86_64 is the first target.
The three components share one repository.

- `backend/` contains the Python 3.12 service, managed with uv. FastAPI exposes
  Pydantic v2 schemas. SQLModel maps the learning data to SQLite, and Alembic
  versions the schema. Agno joins this layer in Phase 2.
- `frontend/` contains a React and TypeScript single-page app built with Vite.
  It uses Tailwind for styling, React Router for navigation and TanStack Query
  for API requests. Its TypeScript API types come from FastAPI's OpenAPI schema.
- `src-tauri/` contains the Tauri 2 shell written in Rust. It owns the window
  and the lifetime of the backend process.

This lets offline exercises and AI-assisted lessons use the same API and local
database. The desktop shell can display the compiled UI without a Node runtime.
