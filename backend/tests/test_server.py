import json
import os
import re
import selectors
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


def test_api_and_static_routes(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RUVOX_DATA_DIR", str(tmp_path / "profile"))
    web_dir = tmp_path / "web"
    web_dir.mkdir()
    (web_dir / "index.html").write_text("test app")
    (web_dir / "asset.js").write_text("test asset")
    with TestClient(create_app(web_dir), base_url="http://localhost") as client:
        assert client.get("/api/health").json() == {"status": "ok"}
        assert (
            client.get("/api/health", headers={"Host": "evil.com"}).status_code == 400
        )
        assert client.get("/alphabet").text == client.get("/").text == "test app"
        assert client.get("/asset.js").text == "test asset"
        assert client.get("/other.js").status_code == 404
        assert client.get("/api/missing").status_code == 404


def test_openapi_without_server(tmp_path: Path) -> None:
    result = subprocess.check_output(
        [sys.executable, "-m", "app.openapi"],
        env={**os.environ, "RUVOX_DATA_DIR": str(tmp_path)},
    )
    assert "/api/health" in json.loads(result)["paths"]
    assert not list(tmp_path.iterdir())


def test_sidecar_keeps_running_without_stdin_watch(tmp_path: Path) -> None:
    with subprocess.Popen(
        [sys.executable, "-m", "app.sidecar", "--no-stdin-watch"],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        text=True,
        env={**os.environ, "RUVOX_DATA_DIR": str(tmp_path)},
    ) as process:
        try:
            assert process.stdout
            assert process.stdout.readline().startswith("RUVOX_READY port=")
            with pytest.raises(subprocess.TimeoutExpired):
                process.wait(timeout=1.5)
        finally:
            process.terminate()


@pytest.mark.parametrize("flags", [[], ["--check-agents"]])
def test_sidecar_handshake_and_eof(tmp_path: Path, flags: list[str]) -> None:
    with subprocess.Popen(
        [sys.executable, "-m", "app.sidecar", *flags],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
        env={**os.environ, "RUVOX_DATA_DIR": str(tmp_path)},
    ) as process:
        try:
            assert process.stdout and process.stdin
            with selectors.DefaultSelector() as selector:
                selector.register(process.stdout, selectors.EVENT_READ)
                assert selector.select(20), "sidecar did not report readiness"
            match = re.fullmatch(r"RUVOX_READY port=(\d+)\n", process.stdout.readline())
            assert match and 0 < int(match[1]) <= 65535
            process.stdin.close()
            assert process.wait(timeout=5) == 0
        finally:
            if process.poll() is None:
                process.kill()
