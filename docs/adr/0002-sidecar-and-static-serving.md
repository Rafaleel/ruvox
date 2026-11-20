# ADR 0002 — Sidecar and static serving

Accepted under D4–D7 in the [project plan](../PLAN.md).

FastAPI serves the Vite build from `backend/app/web/` at `/`, with a fallback
to `index.html` for client-side routes. The API lives under `/api`. A Tauri
window and a browser can therefore load the same app from one origin.

1. Tauri points `frontendDist` at `src-tauri/splash/` for startup and leaves
   the static window list empty. The Rust shell launches the sidecar with
   `uv run python -m app.sidecar` in `backend/` during development. A release
   launches the bundled PyInstaller executable.
2. The sidecar binds to `127.0.0.1` by default. With `--port 0` (the default),
   the OS selects a free port. Once ready, the sidecar writes
   `RUVOX_READY port=<n>` to stdout with the bound port.
3. Rust reads the port and creates the main window at `http://127.0.0.1:<n>/`.
   Tauri stops the child on exit. The sidecar also exits on stdin EOF if the
   parent disappears.

For browser development with hot reload, `make dev-backend` uses port 8000
so Vite can proxy `/api` to a known address. The desktop development command
(`make dev`) builds the frontend and uses the sidecar handshake.
