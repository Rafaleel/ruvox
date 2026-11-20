#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root/backend"
target=$(rustc -vV | sed -n 's/^host: //p')
mode=${1:---onedir}
case "$mode" in
    --onefile) name="ruvox-backend-$target"; output="$root/src-tauri/binaries" ;;
    --onedir) name="ruvox-backend"; output="$root/src-tauri/binaries/runtime" ;;
    *) echo "Usage: $0 [--onedir|--onefile]" >&2; exit 2 ;;
esac
if [[ ! -f app/web/index.html ]]; then
    echo "Build the frontend before packaging the sidecar." >&2
    exit 1
fi
build="build/pyinstaller/${mode#--}"
mkdir -p "$build"
uv run --frozen pyinstaller "$mode" --noconfirm --name "$name" \
    --paths "$PWD" --specpath "$build" --workpath "$build/work" --distpath "$output" \
    --add-data "$PWD/alembic.ini:." --add-data "$PWD/alembic/env.py:alembic" \
    --add-data "$PWD/alembic/versions/*.py:alembic/versions" \
    --add-data "$PWD/app/web:app/web" --add-data "$PWD/app/data:app/data" \
    --copy-metadata agno --copy-metadata anthropic \
    "$PWD/app/sidecar.py"
