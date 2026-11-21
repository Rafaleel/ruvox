"""Opt-in smoke test against the real Anthropic API (never run in CI).

    cd backend && RUVOX_LIVE_LLM=1 ANTHROPIC_API_KEY=... uv run python -m app.live_smoke
    # another provider: RUVOX_LLM_PROVIDER=openai OPENAI_API_KEY=... RUVOX_LLM_MODEL=<id from Settings>

Runs the planner, generator and corrector once in a throwaway data directory and
prints the latency and cost of every call. It spends a few cents.
"""

import os
import sys
import tempfile
from collections.abc import Sequence


def main(argv: Sequence[str] | None = None) -> int:
    if os.getenv("RUVOX_LIVE_LLM") != "1":
        print(
            "Refusing to call the real API: set RUVOX_LIVE_LLM=1 to run this.",
            file=sys.stderr,
        )
        return 2
    provider = os.getenv("RUVOX_LLM_PROVIDER", "anthropic")
    key_env = {
        "anthropic": "ANTHROPIC_API_KEY",
        "openai": "OPENAI_API_KEY",
        "groq": "GROQ_API_KEY",
    }
    if provider not in key_env or not os.getenv(key_env[provider]):
        print(
            f"Set {key_env.get(provider, 'the provider key')} to run the live smoke test.",
            file=sys.stderr,
        )
        return 2
    if provider != "anthropic" and not os.getenv("RUVOX_LLM_MODEL"):
        print(
            "Set RUVOX_LLM_MODEL to a model id your key can use (see Settings).",
            file=sys.stderr,
        )
        return 2

    with tempfile.TemporaryDirectory() as scratch:
        os.environ["RUVOX_DATA_DIR"] = scratch
        return _run()


def _run() -> int:
    from sqlmodel import Session, select

    from app.agents.corrector import review_typed_answer
    from app.agents.generator import AgentQuestionGenerator
    from app.agents.llm import get_llm
    from app.agents.planner import AgentContentPlanner
    from app.db import database_engine, run_migrations, seed
    from app.models import LLMCall
    from app.services.questions import SeedQuestionGenerator
    from app.services.selection import SeedContentPlanner

    engine = database_engine()
    run_migrations(engine)
    with Session(engine) as db:
        seed(db)
        llm = get_llm(engine)
        if llm is None:
            print("No key or model found for the active provider.", file=sys.stderr)
            return 2
        seed_planner = SeedContentPlanner(db)
        planner = AgentContentPlanner(db, llm, seed_planner)
        plan = planner.select(1, 5)
        print(f"planner: source={planner.source} items={[p.item.text for p in plan]}")
        generator = AgentQuestionGenerator(llm, SeedQuestionGenerator(db))
        questions = generator.generate(plan, 5)
        print(f"generator: source={generator.source} questions={len(questions)}")
        for question in questions:
            print(f"  - {question.prompt} -> {question.answer}")
        verdict = review_typed_answer(
            llm,
            question="Digite em russo a letra que faz «tch».",
            expected="Ч",
            given="4",
            explanation="Ч lê-se tch.",
        )
        print(
            f"corrector: correct={verdict.correct} grade={verdict.grade} | {verdict.explanation}"
        )
        calls = db.exec(select(LLMCall)).all()
        for call in calls:
            print(
                f"call agent={call.agent} model={call.model} ok={call.ok} "
                f"latency_ms={call.latency_ms} in={call.input_tokens} out={call.output_tokens} "
                f"cost_usd={call.cost_usd:.5f}"
            )
        print(f"total cost: ${sum(c.cost_usd for c in calls):.5f}")
        failed = [c for c in calls if not c.ok]
        if failed:
            print(f"{len(failed)} call(s) failed: {failed[0].error}", file=sys.stderr)
            return 1
    engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
