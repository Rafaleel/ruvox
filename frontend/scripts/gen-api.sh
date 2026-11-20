#!/usr/bin/env bash
set -euo pipefail
PYTHONPATH=../backend uv run --project ../backend --frozen python -m app.openapi |
    openapi-typescript -o src/api/schema.d.ts "$@"
