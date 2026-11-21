import os
import subprocess
import sys


def run(**env: str) -> subprocess.CompletedProcess[str]:
    clean = {
        k: v
        for k, v in os.environ.items()
        if k
        not in {
            "RUVOX_LIVE_LLM",
            "ANTHROPIC_API_KEY",
            "OPENAI_API_KEY",
            "GROQ_API_KEY",
            "RUVOX_LLM_PROVIDER",
            "RUVOX_LLM_MODEL",
        }
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


def test_other_providers_need_their_own_key_and_a_model() -> None:
    no_key = run(
        RUVOX_LIVE_LLM="1", RUVOX_LLM_PROVIDER="openai", ANTHROPIC_API_KEY="sk-test"
    )
    assert no_key.returncode == 2 and "OPENAI_API_KEY" in no_key.stderr
    no_model = run(
        RUVOX_LIVE_LLM="1", RUVOX_LLM_PROVIDER="groq", GROQ_API_KEY="gsk-test"
    )
    assert no_model.returncode == 2 and "RUVOX_LLM_MODEL" in no_model.stderr
