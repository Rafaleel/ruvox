import os
import subprocess
import sys


def run(**env: str) -> subprocess.CompletedProcess[str]:
    clean = {
        k: v
        for k, v in os.environ.items()
        if k not in {"RUVOX_LIVE_LLM", "ANTHROPIC_API_KEY"}
    }
    return subprocess.run(
        [sys.executable, "-m", "app.live_smoke"],
        env={**clean, **env},
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )


def test_refuses_without_the_opt_in_flag() -> None:
    result = run(ANTHROPIC_API_KEY="sk-test")
    assert result.returncode == 2 and "RUVOX_LIVE_LLM=1" in result.stderr


def test_refuses_without_a_key() -> None:
    result = run(RUVOX_LIVE_LLM="1")
    assert result.returncode == 2 and "ANTHROPIC_API_KEY" in result.stderr
