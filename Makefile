.PHONY: dev dev-backend build-frontend prepare-dev-sidecar

build-frontend:
	pnpm --dir frontend build

prepare-dev-sidecar:
	@mkdir -p src-tauri/binaries/runtime/ruvox-backend

dev:
	pnpm tauri dev

dev-backend:
	cd backend && uv run python -m app.sidecar --port 8000

.PHONY: check check-backend check-frontend check-tauri build-sidecar

check: check-backend check-frontend check-tauri

check-backend:
	cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy . && uv run pytest

check-frontend:
	cd frontend && pnpm gen:api --check && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build

check-tauri: prepare-dev-sidecar
	cd src-tauri && cargo clippy -- -D warnings && cargo test

build-sidecar: build-frontend
	scripts/build-sidecar.sh
