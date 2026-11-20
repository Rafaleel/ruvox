.PHONY: dev dev-backend build-frontend prepare-dev-sidecar

build-frontend:
	pnpm --dir frontend build

prepare-dev-sidecar:
	@mkdir -p src-tauri/binaries/runtime/ruvox-backend

dev:
	pnpm tauri dev

dev-backend:
	cd backend && uv run python -m app.sidecar --port 8000
