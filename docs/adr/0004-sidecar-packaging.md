# ADR 0004 — Package the Python runtime as a directory

Accepted for P0-5 on Linux x86_64. A release ships PyInstaller's one-directory
build as Tauri resources under `sidecar/`. Rust starts the executable there.
Development launches the Python module through uv.

| Build | Bytes before distribution compression | Median time to ready |
| --- | ---: | ---: |
| One directory | 81,436,834 | 0.975 s |
| One file | 42,382,496 | 1.225 s |

Each timing starts a fresh process with an empty data directory and ends at
`RUVOX_READY`, after migrations and alphabet seeding. Five alternating launches
per build used Python 3.12.13 and PyInstaller 6.22.3 on the development machine.
The OS file cache stayed enabled. One directory saves about 250 ms at startup
because its runtime is already unpacked.

Both builds served the compiled home page and health endpoint, seeded 33 letters
at revision 0001, and exited on stdin EOF. To reproduce, build the frontend and
run `scripts/build-sidecar.sh --onedir` or `scripts/build-sidecar.sh --onefile`.
The bundle includes the Alembic configuration, environment and revisions,
alphabet data, and static frontend. The standard PyInstaller hooks suffice.
The build copies distribution metadata for Agno and Anthropic. Hook warnings
for the optional database drivers pysqlite2 and MySQLdb did not affect SQLite.

## Agno contract

With Agno 3.2.1 and anthropic 2.12.0, both frozen executables loaded
`Agent`, `Team`, `Claude` and `Anthropic` through the `--check-agents` probe.
The installed API accepts a Pydantic model in `Agent(output_schema=...)`.
The coordination API is `Team(mode=TeamMode.coordinate)`, with `route`,
`broadcast` and `tasks` also available. `agno.models.anthropic.Claude`
accepted `id="claude-sonnet-5-5"` in an offline constructor check.
Provider availability for an account requires a live call.
