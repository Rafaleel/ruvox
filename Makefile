.PHONY: dev dev-backend build-frontend prepare-dev-sidecar

build-frontend:
	pnpm --dir frontend build

prepare-dev-sidecar:
	@mkdir -p src-tauri/binaries/runtime/ruvox-backend

dev:
	pnpm tauri dev

dev-backend:
	cd backend && uv run python -m app.sidecar --port 8000 --no-stdin-watch

.PHONY: check check-backend check-frontend check-tauri build-sidecar release

check: check-backend check-frontend check-tauri

check-backend:
	cd backend && uv run --frozen ruff check . && uv run --frozen ruff format --check . && uv run --frozen mypy . && uv run --frozen pytest

check-frontend:
	cd frontend && pnpm gen:api --check && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build

check-tauri: prepare-dev-sidecar
	cd src-tauri && cargo clippy -- -D warnings && cargo test

build-sidecar: build-frontend
	scripts/build-sidecar.sh

# Installable build: .deb and AppImage under src-tauri/target/release/bundle/.
# `pnpm tauri build` runs `make build-sidecar` first (frontend + PyInstaller).
release:
	pnpm install --frozen-lockfile --dir frontend
	pnpm tauri build
