import json
import os
import re
import selectors
import subprocess
import sys
import urllib.error
import urllib.request
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, read_settings, write_settings
from app.lan import MAX_FAILURES, WINDOW_SECONDS, PairingState, host_allowed, lan_ip
from app.main import create_app


@pytest.mark.parametrize(
    ("host", "lan", "allowed"),
    [
        ("localhost", False, True),
        ("LOCALHOST:8000", False, True),
        ("127.0.0.1:9999", False, True),
        ("[::1]:8000", False, True),
        ("evil.com", False, False),
        ("evil.com", True, False),
        ("localhost.evil.com", True, False),
        ("127.0.0.1.evil.com", True, False),
        ("192.168.1.10:8787", False, False),
        ("192.168.1.10:8787", True, True),
        ("10.0.0.5", True, True),
        ("8.8.8.8", True, False),
        ("", True, False),
    ],
)
def test_host_rules(host: str, lan: bool, allowed: bool) -> None:
    assert host_allowed(host, lan) is allowed


def test_pairing_codes_rate_limit_and_rotation() -> None:
    state = PairingState("ab" * 32)
    code = state.code
    assert re.fullmatch(r"\d{6}", code)
    for attempt in range(MAX_FAILURES):
        assert not state.try_pair(
            "phone", "000000" if code != "000000" else "111111", now=attempt
        )
    assert state.blocked("phone", now=MAX_FAILURES)
    assert not state.try_pair(
        "phone", code, now=MAX_FAILURES
    )  # even the right code, while blocked
    assert not state.blocked("phone", now=WINDOW_SECONDS + MAX_FAILURES + 1)
    assert state.try_pair("phone", code, now=WINDOW_SECONDS + 10)
    assert re.fullmatch(r"\d{6}", state.code)  # a new code is drawn after pairing
    assert (
        state.valid(state.token()) and not state.valid("nope") and not state.valid(None)
    )


@pytest.fixture
def lan(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Iterator[tuple[TestClient, TestClient]]:
    monkeypatch.setenv("RUVOX_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    write_settings(Settings(lan_enabled=True))
    app = create_app(tmp_path / "no-web")
    assert app.state.lan_enabled
    with TestClient(
        app, base_url="http://127.0.0.1:8787", client=("127.0.0.1", 50000)
    ) as desktop:
        phone = TestClient(
            app, base_url="http://192.168.1.10:8787", client=("192.168.1.50", 5000)
        )
        yield desktop, phone


def test_an_unpaired_phone_is_refused_but_the_desktop_is_not(
    lan: tuple[TestClient, TestClient],
) -> None:
    desktop, phone = lan
    assert phone.get("/api/health").status_code == 200
    assert phone.get("/api/progress").status_code == 401
    assert phone.get("/api/lan/status").json() == {"required": True, "paired": False}
    assert desktop.get("/api/progress").status_code == 200
    assert desktop.get("/api/lan/status").json() == {"required": False, "paired": True}


def test_pairing_flow(lan: tuple[TestClient, TestClient]) -> None:
    desktop, phone = lan
    info = desktop.get("/api/lan").json()
    assert info["enabled"] and info["running"] and re.fullmatch(r"\d{6}", info["code"])
    wrong = "000000" if info["code"] != "000000" else "111111"
    assert phone.post("/api/lan/pair", json={"code": wrong}).status_code == 403
    assert phone.post("/api/lan/pair", json={"code": info["code"]}).status_code == 204
    assert phone.get("/api/progress").status_code == 200
    assert phone.get("/api/lan/status").json() == {"required": True, "paired": True}
    assert (
        desktop.get("/api/lan").json()["code"] != info["code"]
    )  # one code, one device
    again = phone.post("/api/lan/pair", json={"code": info["code"]})
    assert again.status_code == 403


def test_too_many_wrong_codes_are_throttled(lan: tuple[TestClient, TestClient]) -> None:
    desktop, phone = lan
    code = desktop.get("/api/lan").json()["code"]
    wrong = "000000" if code != "000000" else "111111"
    statuses = [
        phone.post("/api/lan/pair", json={"code": wrong}).status_code for _ in range(7)
    ]
    assert statuses[:5] == [403] * 5 and statuses[5:] == [429, 429]
    assert phone.post("/api/lan/pair", json={"code": code}).status_code == 429


def test_a_paired_phone_cannot_change_lan_settings(
    lan: tuple[TestClient, TestClient],
) -> None:
    desktop, phone = lan
    phone.post("/api/lan/pair", json={"code": desktop.get("/api/lan").json()["code"]})
    assert phone.get("/api/lan").status_code == 403
    assert phone.put("/api/lan", json={"enabled": False}).status_code == 403
    assert phone.post("/api/lan/unpair").status_code == 403
    assert phone.post("/api/lan/code").status_code == 403


def test_unpair_everyone(lan: tuple[TestClient, TestClient]) -> None:
    desktop, phone = lan
    phone.post("/api/lan/pair", json={"code": desktop.get("/api/lan").json()["code"]})
    assert phone.get("/api/progress").status_code == 200
    assert desktop.post("/api/lan/unpair").status_code == 204
    assert phone.get("/api/progress").status_code == 401
    assert read_settings().lan_secret


def test_lan_mode_still_rejects_domain_hosts(
    lan: tuple[TestClient, TestClient],
) -> None:
    _, phone = lan
    assert phone.get("/api/health", headers={"Host": "evil.com"}).status_code == 400


def test_toggling_saves_the_choice_and_asks_for_a_restart(client: TestClient) -> None:
    restarts: list[bool] = []
    client.app.state.restart = lambda: restarts.append(True)  # type: ignore[attr-defined]
    assert client.get("/api/lan/status").json() == {"required": False, "paired": True}
    assert client.post("/api/lan/pair", json={"code": "123456"}).status_code == 404
    on = client.put("/api/lan", json={"enabled": True}).json()
    assert on["enabled"] is True and on["running"] is False and restarts == [True]
    saved = read_settings()
    assert saved.lan_enabled and saved.lan_secret
    client.put(
        "/api/settings", json={"api_key": "sk-x"}
    )  # must not clobber the LAN fields
    assert (
        read_settings().lan_enabled and read_settings().lan_secret == saved.lan_secret
    )
    client.put("/api/lan", json={"enabled": False})
    assert read_settings().lan_enabled is False


def read_ready(process: subprocess.Popen[str]) -> int:
    assert process.stdout
    with selectors.DefaultSelector() as selector:
        selector.register(process.stdout, selectors.EVENT_READ)
        assert selector.select(30), "sidecar did not report readiness"
    match = re.fullmatch(r"RUVOX_READY port=(\d+)\n", process.stdout.readline())
    assert match
    return int(match[1])


def get(url: str, host: str | None = None) -> tuple[int, Any]:
    request = urllib.request.Request(url, headers={"Host": host} if host else {})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read() or b"null")


@pytest.mark.skipif(lan_ip() is None, reason="no LAN address on this machine")
def test_the_sidecar_binds_the_network_only_when_enabled(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RUVOX_DATA_DIR", str(tmp_path))
    address = lan_ip()
    env = {**os.environ, "RUVOX_DATA_DIR": str(tmp_path)}
    for enabled in (False, True):
        write_settings(Settings(lan_enabled=enabled, lan_secret="ab" * 32))
        with subprocess.Popen(
            [sys.executable, "-m", "app.sidecar", "--port", "0"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            env=env,
        ) as process:
            try:
                port = read_ready(process)
                if not enabled:
                    with pytest.raises(OSError):
                        urllib.request.urlopen(
                            f"http://{address}:{port}/api/health", timeout=3
                        )
                else:
                    assert get(f"http://{address}:{port}/api/health")[0] == 200
                    status, _ = get(f"http://{address}:{port}/api/progress")
                    assert status == 401  # reached over the network: needs pairing
                    assert get(f"http://127.0.0.1:{port}/api/progress")[0] == 200
            finally:
                if process.stdin:
                    process.stdin.close()
                process.wait(timeout=10)
