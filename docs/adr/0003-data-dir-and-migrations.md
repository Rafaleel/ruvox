# ADR 0003 — Data directory and migrations

Accepted under D2, D8 and D9 in the [project plan](../PLAN.md).

Replacing the application or switching checkouts should preserve lessons and
settings. The backend resolves the OS user data directory with `platformdirs`
and the app name `ruvox`. Set `RUVOX_DATA_DIR` to use another directory, for
example a temporary one for tests.

- The SQLite database lives in that directory. On startup the backend runs
  Alembic migrations before serving requests. An empty directory receives the
  initial schema, and existing installations apply pending revisions in order.
- The backend stores the API key and model from the Settings screen in
  `config.json` in the same directory, with file mode `0600` (owner read/write).
  When set, `ANTHROPIC_API_KEY` takes precedence over the stored key. Offline
  exercises need no key.
